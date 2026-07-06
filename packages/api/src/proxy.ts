import { lookup } from "node:dns/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AGENT, REFERER } from "./allanime/source-extractor.js";

const ALLOWED_HOSTS = process.env.PROXY_ALLOWED_HOSTS
  ? process.env.PROXY_ALLOWED_HOSTS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : null;

function isPrivateIP(ip: string): boolean {
  if (ip.includes(":")) {
    if (ip === "::1" || ip === "::") return true;
    const lower = ip.toLowerCase();
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function handleVideoProxy(
  req: FastifyRequest<{ Querystring: { url?: string; referer?: string } }>,
  reply: FastifyReply,
) {
  const url = req.query.url;
  const referer = req.query.referer ?? REFERER;

  if (!url) return reply.code(400).send({ error: "Missing url" });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return reply.code(400).send({ error: "Invalid url" });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return reply.code(400).send({ error: "Unsupported scheme" });
  }

  if (ALLOWED_HOSTS && !ALLOWED_HOSTS.includes(target.hostname.toLowerCase())) {
    return reply.code(403).send({ error: "Host not allowed" });
  }

  let addresses: string[];
  try {
    const result = await lookup(target.hostname, { all: true });
    addresses = result.map((r) => r.address);
  } catch {
    return reply.code(400).send({ error: "Unresolvable host" });
  }
  if (addresses.length === 0 || addresses.some(isPrivateIP)) {
    return reply.code(403).send({ error: "Blocked host" });
  }

  const range = req.headers.range;
  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent": AGENT,
      Referer: referer,
      ...(typeof range === "string" ? { Range: range } : {}),
    },
  });

  const passThrough = ["content-type", "content-length", "content-range", "accept-ranges"];
  for (const key of passThrough) {
    const value = upstream.headers.get(key);
    if (value) reply.header(key, value);
  }

  return reply.status(upstream.status).send(upstream.body);
}
