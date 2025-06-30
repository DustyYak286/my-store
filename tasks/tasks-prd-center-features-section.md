## Relevant Files

- `src/app/globals.css` - To add CSS for smooth scrolling behavior.
- `src/components/Branding.tsx` - The component whose styling and scroll alignment needs to be fixed.
- `src/components/Navbar.tsx` - Contains the "Features" link.
- `src/components/Footer.tsx` - Contains the "Features" link.

### Notes

- The primary goal is to use modern CSS properties to handle scroll behavior and alignment cleanly.

## Tasks

- [x] 1.0 Enable site-wide smooth scrolling and snapping.
  - [x] 1.1 In `src/app/globals.css`, add `scroll-behavior: smooth;` to the `html` element to enable smooth scrolling for anchor links.
  - [x] 1.2 In `src/app/globals.css`, add `scroll-snap-type: y proximity;` to the `html` element to enable snap-to-element behavior.
- [x] 2.0 Refactor the `Branding` component's styling.
  - [x] 2.1 In `src/components/Branding.tsx`, remove the classes used for the full-width hack: `w-screen`, `relative`, `left-1/2`, `right-1/2`, `-mx-[50vw]`, and `ml-[-50vw]`.
- [x] 3.0 Implement CSS rules to vertically center the `Branding` component.
  - [x] 3.1 In `src/app/globals.css`, add a new rule `#features { scroll-snap-align: center; }` to instruct the browser to center this element in the viewport when snapping.
- [x] 4.0 Verify functionality.
  - [x] 4.1 Manually test by clicking the "Features" link in the Navbar and Footer.
- [x] 4.2 Confirm the scroll is smooth and the `Branding` section is vertically centered.
- [x] 5.0 Conduct final testing.
  - [x] 5.1 Test on desktop and mobile screen sizes to ensure consistent behavior.
- [x] 6.0 Restore full-width background for the Features section.
  - [x] 6.1 In `src/components/Branding.tsx`, add a `relative` class to the main `div` to create a positioning context for the pseudo-element.
  - [x] 6.2 In `src/app/globals.css`, add a CSS rule for `#features::before` to create the full-width background, ensuring it sits behind the content.
  - [x] 6.3 In `src/components/Branding.tsx`, remove `bg-[#f8f8f8]` from the main `div` as the background will be handled by the `::before` pseudo-element.
  - [x] 6.4 In `src/app/globals.css`, remove `overflow: hidden;` from `#features` to prevent clipping of the full-width background.
  - [x] 6.5 In `src/app/globals.css`, modify the `#features::before` rule to use `left: 0; right: 0;` instead of `left: 50%; transform: translateX(-50%);` for a more reliable full-width background.
  - [x] 6.6 In `src/components/Branding.tsx`, wrap the existing content in a new `div` with `max-w-7xl mx-auto` and `py-16 px-6` classes. The outer `div` will handle the full-width background.
  - [x] 6.7 In `src/components/Branding.tsx`, add `bg-[#f8f8f8]` to the outer `div` to provide the full-width background.
  - [x] 6.8 In `src/components/Branding.tsx`, remove `py-16 px-6` from the outer `div` as it will be applied to the inner content `div`.
  - [x] 6.9 In `src/components/Branding.tsx`, add `w-screen` to the outer `div` to ensure it spans the full viewport width.
  - [x] 6.10 In `src/components/Branding.tsx`, remove the extra `>` from the outer `div` tag.
  - [x] 6.11 In `src/components/Branding.tsx`, add `flex justify-center` to the outer `div` to ensure its content is horizontally centered.

