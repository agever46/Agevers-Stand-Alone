# Plan: Persistent purple borders for cart items

The user wants cart items to have a persistent purple border that changes color and thickens on hover.

## Proposed Changes

### 1. Update Navbar cart dropdown
- Modify the cart item container in `src/components/Navbar.tsx` (around line 328).
- Add a persistent purple border using Tailwind classes.
- Add hover effects to change border color and increase thickness.

### 2. Update Checkout page item list
- Modify the cart item container in `src/pages/Checkout.tsx` (around line 1334).
- Apply similar purple border styling and hover effects.

## Technical Details

- Use a purple border class (e.g., `border-2 border-primary/40`) as the base state.
- Use hover classes (e.g., `hover:border-primary hover:border-4`) for the interactive state.
- Ensure consistent padding and layout to accommodate the changing border thickness without shifting content significantly (using `box-sizing: border-box`).

---

**Note**: The user requested that the purple border be persistent and that it changes color and becomes thicker on hover.
