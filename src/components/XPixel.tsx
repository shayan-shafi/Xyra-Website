"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { adTrackingAllowed, captureTwclid } from "@/lib/analytics";

// X conversion tracking base code, loaded once from the root layout. The
// snippet below is X's, unchanged. It only mounts for visitors who haven't
// opted out (footer → privacy settings / Do Not Track / Global Privacy
// Control). See adTrackingAllowed in src/lib/analytics.ts.
const X_BASE_CODE = `!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('config','rihth');`;

export default function XPixel() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const ok = adTrackingAllowed();
    if (ok) captureTwclid();
    setAllowed(ok);
  }, []);

  if (!allowed) return null;

  return (
    <>
      {/* X conversion tracking base code */}
      <Script id="x-pixel-base" strategy="afterInteractive">
        {X_BASE_CODE}
      </Script>
      {/* End X conversion tracking base code */}
    </>
  );
}
