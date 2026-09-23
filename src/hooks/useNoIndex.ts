import { useEffect } from "react";

// Marks the current page as noindex,follow — for private/transactional
// routes (checkout, account, admin, order confirmation, auth) that must
// stay reachable but should never appear in search results. robots.txt
// intentionally does not Disallow these paths: a Disallow stops the page
// from ever being crawled, which means Google can't see this tag either
// and a page linked from elsewhere can still show up in results with no
// snippet. noindex is the correct control here.
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, follow";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
