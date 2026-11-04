Experience logos come from the organizations' own websites; URLs are in sources.json.

- Order.co: original green site icon.
- Generative AI at Cornell: original red vector mark from /brand/logo.svg.
- Cornell FinTech Club: original standalone site icon, matching the emblem in its header logo. `cornell-fintech-red.svg` embeds the original alpha artwork with an SVG color matrix to render its fine circuit lines in bright red (#EF625C) for contrast on the dark page.
- Cornell: official simple seal from the Cornell Brand Center, rendered in Cornell's official Carnelian red (#B31B1B), rather than the black preview color. Shape and proportions are unchanged. Color reference: https://staff.cce.cornell.edu/brand/fonts-and-colors
- Penn: full-color shield from Penn's official website logo. The SVG viewport isolates the shield from the accompanying wordmark; the shield paths and colors are unchanged.

The *-brand.png files are transparent, high-resolution display copies. Empty source margins are removed without stretching the artwork. Logos appear directly on the page without frames, backgrounds, borders, or shadows. CSS sizes every mark at 92% of its layout slot while preserving its aspect ratio and horizontal centering. The alignment script measures image alpha and the final line of company-link text after fonts load, matching the artwork's bottom visible pixel to the text's bottom ink edge. FinTech uses a dedicated bright red rendering for contrast; the other marks retain their original colors.
