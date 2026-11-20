const http = require("http");

async function main() {
  const versionRes = await fetch("http://127.0.0.1:9222/json/version");
  const versionData = await versionRes.json();
  console.log("Connected to Chrome:", versionData.Browser);

  const newTargetRes = await fetch("http://127.0.0.1:9222/json/new", { method: "PUT" });
  const target = await newTargetRes.json();
  const wsUrl = target.webSocketDebuggerUrl;
  console.log("Created target tab:", target.id);

  const ws = new WebSocket(wsUrl);

  let messageId = 0;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((res) => (ws.onopen = res));

  await send("Page.enable");
  await send("Runtime.enable");

  await send("Page.navigate", { url: "http://127.0.0.1:3000/" });
  await new Promise((r) => setTimeout(r, 2000));

  const viewports = [
    { name: "Large Desktop (1920x1080 @ 100%)", width: 1920, height: 1080, scale: 1 },
    { name: "Desktop 125% Zoom (1536x864 effective)", width: 1536, height: 864, scale: 1.25 },
    { name: "Standard Desktop (1440x900 @ 100%)", width: 1440, height: 900, scale: 1 },
    { name: "Min Desktop (1280x800 @ 100%)", width: 1280, height: 800, scale: 1 },
    { name: "Desktop 150% Zoom on 1920 (1280x720 effective)", width: 1280, height: 720, scale: 1.5 },
    { name: "Desktop 110% Zoom on 1366 (1240x700 effective)", width: 1240, height: 700, scale: 1.1 },
    { name: "Smaller Desktop (1150x800)", width: 1150, height: 800, scale: 1 },
    { name: "Tablet Landscape / iPad Pro (1024x768)", width: 1024, height: 768, scale: 1 },
    { name: "Tablet Portrait / iPad (768x1024)", width: 768, height: 1024, scale: 1 },
    { name: "Mobile Phone (390x844)", width: 390, height: 844, scale: 1 },
    { name: "Small Mobile (360x740)", width: 360, height: 740, scale: 1 },
  ];

  console.log("\n=================== RESPONSIVE NAVBAR VERIFICATION ===================");

  let allPass = true;

  for (const vp of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.scale,
      mobile: vp.width < 768,
    });

    await new Promise((r) => setTimeout(r, 300));

    const evalResult = await send("Runtime.evaluate", {
      expression: `(() => {
        const docElem = document.documentElement;
        const header = document.querySelector('header');
        const desktopNav = header ? header.querySelector('nav') : null;
        const mobileBtn = document.getElementById('mobile-menu-button');
        
        const winWidth = window.innerWidth;
        const pageClientW = docElem.clientWidth;
        const pageScrollW = docElem.scrollWidth;
        const pageOverflow = pageScrollW > pageClientW;
        
        const headerClientW = header ? header.clientWidth : 0;
        const headerScrollW = header ? header.scrollWidth : 0;
        const headerOverflow = headerScrollW > headerClientW;

        const desktopNavVisible = desktopNav ? (desktopNav.offsetParent !== null && window.getComputedStyle(desktopNav).display !== 'none') : false;
        const mobileBtnVisible = mobileBtn ? (mobileBtn.offsetParent !== null && window.getComputedStyle(mobileBtn).display !== 'none') : false;

        let navOverflow = false;
        let navScrollWidth = 0;
        let navClientWidth = 0;
        if (desktopNav && desktopNavVisible) {
          navScrollWidth = desktopNav.scrollWidth;
          navClientWidth = desktopNav.clientWidth;
          navOverflow = navScrollWidth > navClientWidth;
        }

        return {
          winWidth,
          pageClientW,
          pageScrollW,
          pageOverflow,
          headerClientW,
          headerScrollW,
          headerOverflow,
          desktopNavVisible,
          mobileBtnVisible,
          navScrollWidth,
          navClientWidth,
          navOverflow
        };
      })()`,
      returnByValue: true,
    });

    const res = evalResult.result.value;
    const status = !res.pageOverflow && !res.headerOverflow && !res.navOverflow ? "PASS" : "FAIL";
    if (status === "FAIL") allPass = false;

    console.log(`\nViewport: ${vp.name}`);
    console.log(`  Window: ${res.winWidth}px | Page: client=${res.pageClientW}px, scroll=${res.pageScrollW}px (Page Overflow: ${res.pageOverflow})`);
    console.log(`  Header: client=${res.headerClientW}px, scroll=${res.headerScrollW}px (Header Overflow: ${res.headerOverflow})`);
    console.log(`  Desktop Nav visible: ${res.desktopNavVisible}${res.desktopNavVisible ? ` (client=${res.navClientWidth}px, scroll=${res.navScrollWidth}px, Nav Overflow=${res.navOverflow})` : ""}`);
    console.log(`  Mobile Menu Button visible: ${res.mobileBtnVisible}`);
    console.log(`  => Status: ${status}`);

    if (res.mobileBtnVisible) {
      await send("Runtime.evaluate", {
        expression: `document.getElementById('mobile-menu-button').click()`,
      });
      await new Promise((r) => setTimeout(r, 200));

      const drawerCheck = await send("Runtime.evaluate", {
        expression: `(() => {
          const drawer = document.getElementById('mobile-navigation-menu');
          if (!drawer) return { open: false };
          const links = Array.from(drawer.querySelectorAll('a')).map(a => a.textContent.trim()).filter(Boolean);
          const drawerScrollW = drawer.scrollWidth;
          const drawerClientW = drawer.clientWidth;
          return {
            open: true,
            drawerOverflow: drawerScrollW > drawerClientW,
            linkCount: links.length,
            links: links.slice(0, 6)
          };
        })()`,
        returnByValue: true,
      });

      const drawerRes = drawerCheck.result.value;
      console.log(`  Drawer Test: Open=${drawerRes.open}, LinksCount=${drawerRes.linkCount}, DrawerOverflow=${drawerRes.drawerOverflow}`);

      await send("Runtime.evaluate", {
        expression: `document.getElementById('mobile-menu-button').click()`,
      });
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  await fetch(`http://127.0.0.1:9222/json/close/${target.id}`, { method: "PUT" });
  ws.close();
  console.log("\n=================== VERIFICATION RESULT ===================");
  console.log(`OVERALL RESULT: ${allPass ? "ALL TESTS PASSED!" : "SOME TESTS FAILED!"}`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
