// Per-instance Birdy mascot artwork — everything inside the <svg> root.
// The outer <svg> element itself (viewBox, className, data-birdy-state, ref)
// is a real React element in Birdy.jsx; this is its innerHTML, injected raw
// so the thousands of plain SVG attributes below don't need camelCasing.
// Ported verbatim from the design handoff (birdy-markup.html).
export const BIRDY_INNER_MARKUP = `
  <g transform="translate(1024,2100) scale(1.07) translate(-1024,-2100)">
    <g data-p="bird" style="transform-box:view-box;transform-origin:1024px 2100px">
      <use href="#brd-head"></use>
      <g data-p="eyeL" style="transform-box:view-box;transform-origin:504px 1359px"><use href="#brd-ballLpath"></use><g clip-path="url(#brd-ballL)"><g data-p="irisL" style="transform-box:view-box;transform-origin:504px 1359px"><use href="#brd-irisL"></use></g><g data-p="glintL" style="transform-box:view-box;transform-origin:504px 1359px"><use href="#brd-glintL"></use></g></g></g>
      <g data-p="eyeR" style="transform-box:view-box;transform-origin:1544px 1359px"><use href="#brd-ballRpath"></use><g clip-path="url(#brd-ballR)"><g data-p="irisR" style="transform-box:view-box;transform-origin:1544px 1359px"><use href="#brd-irisR"></use></g><g data-p="glintR" style="transform-box:view-box;transform-origin:1544px 1359px"><use href="#brd-glintR"></use></g></g></g>
      <g clip-path="url(#brd-lidclipL)"><g data-p="lidL" style="transform:scaleY(0);transform-box:view-box;transform-origin:504px 1041px">
        <path d="M84 901L924 901L924 1500Q504 1616 84 1500Z" fill="#D658EB" stroke="#70127D" stroke-width="34" stroke-linejoin="round"></path>
      </g></g>
      <g clip-path="url(#brd-lidclipR)"><g data-p="lidR" style="transform:scaleY(0);transform-box:view-box;transform-origin:1544px 1041px">
        <path d="M1124 901L1964 901L1964 1500Q1544 1616 1124 1500Z" fill="#D658EB" stroke="#70127D" stroke-width="34" stroke-linejoin="round"></path>
      </g></g>
      <g data-p="beak" style="transform-box:fill-box;transform-origin:50% 6%"><use href="#brd-beak"></use></g>
      <use href="#brd-cheeks"></use>
    </g>
  </g>
  <text data-p="q" x="1770" y="470" text-anchor="middle" font-size="440" font-weight="700" fill="#70127D" style="opacity:0;font-family:Outfit,sans-serif;transform-box:fill-box;transform-origin:50% 50%">?</text>
  <text data-p="bang" x="1780" y="470" text-anchor="middle" font-size="440" font-weight="700" fill="#F0694C" style="opacity:0;font-family:Outfit,sans-serif;transform-box:fill-box;transform-origin:50% 50%">!</text>
  <path data-p="check" d="M1622 372L1730 490L1930 214" fill="none" stroke="#70127D" stroke-width="92" stroke-linecap="round" stroke-linejoin="round" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"></path>
  <text data-p="z1" x="1520" y="900" font-size="290" font-weight="600" fill="#70127D" style="opacity:0;font-family:Outfit,sans-serif;transform-box:fill-box;transform-origin:50% 50%">z</text>
  <text data-p="z2" x="1520" y="900" font-size="290" font-weight="600" fill="#70127D" style="opacity:0;font-family:Outfit,sans-serif;transform-box:fill-box;transform-origin:50% 50%">z</text>
  <text data-p="z3" x="1520" y="900" font-size="290" font-weight="600" fill="#70127D" style="opacity:0;font-family:Outfit,sans-serif;transform-box:fill-box;transform-origin:50% 50%">z</text>
  <g transform="translate(1740,430)"><circle data-p="ring" r="150" fill="none" stroke="#F0694C" stroke-width="44" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"></circle><circle data-p="dot" r="58" fill="#F0694C" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"></circle></g>
  <g transform="translate(1730,700) scale(1.5)"><g data-p="hrt1" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0 92C-120 8-96-84-40-84C-14-84 0-64 0-52C0-64 14-84 40-84C96-84 120 8 0 92Z" fill="#FC60AC"></path></g></g>
  <g transform="translate(280,780) scale(1.5)"><g data-p="hrt2" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0 70C-92 6-73-64-30-64C-11-64 0-49 0-40C0-49 11-64 30-64C73-64 92 6 0 70Z" fill="#F0694C"></path></g></g>
  <g transform="translate(1020,470) scale(1.5)"><g data-p="hrt3" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0 58C-77 5-61-53-25-53C-9-53 0-41 0-33C0-41 9-53 25-53C61-53 77 5 0 58Z" fill="#FC60AC"></path></g></g>
  <g transform="translate(268,352)"><g data-p="sp1" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0-96Q18-24 96 0Q18 24 0 96Q-18 24-96 0Q-18-24 0-96Z" fill="#FC60AC"></path></g></g>
  <g transform="translate(1780,300)"><g data-p="sp2" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0-76Q14-18 76 0Q14 18 0 76Q-14 18-76 0Q-14-18 0-76Z" fill="#F0694C"></path></g></g>
  <g transform="translate(430,120)"><g data-p="sp3" style="opacity:0;transform-box:fill-box;transform-origin:50% 50%"><path d="M0-62Q12-14 62 0Q12 14 0 62Q-12 14-62 0Q-12-14 0-62Z" fill="#FC60AC"></path></g></g>
`;
