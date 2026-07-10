import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api-base";
import { JimakuKeySettings } from "./JimakuKeySettings";
import { SiteNav } from "./SiteNav";

export function SettingsPage() {
  const [serverHasJimaku, setServerHasJimaku] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((r) => r.json())
      .then((d: { jimaku?: boolean }) => setServerHasJimaku(Boolean(d.jimaku)))
      .catch(() => setServerHasJimaku(false));
  }, []);

  return (
    <div className="ip-root">
      <SiteNav active="settings" />
      <main className="ip-page ip-settings-page">
        <h1 className="ip-page-title">Settings</h1>
        {serverHasJimaku && (
          <p className="ip-jimaku-key-note">
            Jimaku fan subtitles are provided by the server — no API key needed in your browser.
            You can still paste your own key below to override.
          </p>
        )}
        <JimakuKeySettings serverHasJimaku={serverHasJimaku === true} />
      </main>
    </div>
  );
}
