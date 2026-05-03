# ParkMate Pro Experience Spec

Date: 2026-04-29

## Goal

Make ParkMate Pro feel like a complete premium mode, not a small set of locked controls.

The current product has entitlement plumbing, a paywall, and a few gated UI surfaces, but the experience is fragmented. This spec defines a more complete Pro layer that:

- Has a distinct identity
- Activates immediately after purchase
- Changes the app's behavior, not just the labels
- Gives users a place to understand, manage, and value Pro
- Keeps core community actions free

## What Is Weak Today

Current Pro touchpoints are spread across the app:

- A full-screen paywall in [anything/apps/mobile/src/components/paywall/ProPaywall.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/components/paywall/ProPaywall.jsx)
- A small membership card on Profile in [anything/apps/mobile/src/app/(tabs)/profile.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/profile.jsx)
- Locked radius and sort chips in Notifications in [anything/apps/mobile/src/app/(tabs)/notifications.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/notifications.jsx)
- Locked reminder presets in Timer in [anything/apps/mobile/src/app/(tabs)/timer.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/timer.jsx)

This works as gating, but it does not create a premium product feel.

## Product Principle

ParkMate Pro should feel like:

- Smarter
- Faster
- More personal
- Easier to trust

It should not feel like:

- A feature lock overlay
- A random upsell modal
- A second-class app shell

## Experience Pillars

### 1. Pro Is A Mode, Not Just An Entitlement

Once a user buys Pro, the app should visibly shift.

Examples:

- The app should open a Pro landing state at least once after unlock.
- Premium controls should feel like saved preferences, not one-off toggles.
- Pro should have a dedicated hub that summarizes the upgrade.

### 2. Pro Should Improve Decision Quality

Premium value should be framed around better parking decisions:

- Wider radar control
- Better signal sorting
- Stronger reminder control
- Deeper contribution insight

### 3. Pro Should Stay Private And Personal

The best premium parts are the ones that help the user understand their own behavior and outcomes.

That means:

- Personal trend summaries
- Claim conversion
- Trust and contribution pacing
- Streaks or consistency signals

### 4. Core Community Actions Stay Free

Do not gate the actions that power the data flywheel:

- View nearby parking activity
- Report a spot
- Claim a spot
- Flag false reports
- Open zones and spots
- Use the base timer

## Proposed Pro IA

Add a dedicated `Pro Center` entry point from Profile.

### Pro Center Content

- Active status
- One-line value proposition
- Current price or lifetime status
- Restore access
- Manage access/help
- Feature summary
- Personal progress snapshot

### Suggested Sections

1. Hero
- `ParkMate Pro`
- Status chip: `Active` or `Available`
- Short promise: `Smarter parking, made personal`

2. What You Get
- Pro radar
- Best chance intelligence
- Custom reminder patterns
- Deeper contribution insights

3. Personal Impact
- Claim conversion
- Impact per report
- Recent streak or consistency signal
- Next profile unlock pace

4. Access Actions
- Open paywall if not active
- Restore access
- Open support/help
- Return to app

## Screen Changes

### Profile

Current issue:

- The Pro card is present, but it behaves like a small promo block.

Desired change:

- Make Profile the Pro home base.
- Replace the single upgrade card with a richer `Pro Center` panel.
- If active, show a compact premium summary rather than just `Active`.

Suggested additions:

- `Open Pro Center`
- `What Pro changes`
- `Restore access`
- `Pro usage snapshot`

### Notifications

Current issue:

- Premium options are just locked chips.

Desired change:

- Make radius and sort feel like a premium radar workspace.
- Preserve free browsing, but elevate Pro with better grouping and presets.

Suggested additions:

- Saved Pro presets
- More descriptive confidence labels
- A small `Pro` mode banner when active
- Optional “recommended” preset highlight after unlock

### Timer

Current issue:

- Pro reminders are just a few extra buttons.

Desired change:

- Present reminder presets as a curated assistant instead of a hidden unlock.
- When Pro is active, explain how each pattern changes the timer behavior.

Suggested additions:

- Preset explanations
- `Best for short stays` style helper copy
- A post-purchase “recommended reminder setup”

### Paywall

Current issue:

- It is polished, but still reads as a modal with feature bullets.

Desired change:

- Keep the premium motion, but make the copy more outcome-oriented.
- Show what changes right now after purchase.
- Clarify that this is a lifetime upgrade, not a recurring subscription.

Suggested additions:

- `What changes immediately`
- `Why Pro matters today`
- `One payment, permanent access`
- `After unlock` preview tiles

## Recommended Premium Mechanics

### 1. First Unlock Flow

After a successful purchase:

- Dismiss the paywall
- Show a short confirmation state
- Land on the Pro Center or the originating screen with a Pro-specific highlight
- Apply a recommended default configuration

### 2. Default Pro Presets

Give Pro a sensible starting point so it feels activated, not just purchased.

Examples:

- Radius: `500m` or a user-selected last choice
- Sort: `Best chance`
- Timer: a recommended warning pattern
- Profile: open to insights first

### 3. Persistent Identity

Pro should keep its own visual language:

- A distinct header treatment
- A stronger gradient or highlight color
- Clear status chips
- More refined microcopy

## Content Strategy

The strongest premium value proposition for ParkMate is not “more controls.”

It is:

- Better parking decisions
- Less manual effort
- More confidence
- A cleaner mental model of the user's own contribution quality

Suggested headline directions:

- `Smarter parking for life`
- `Your parking intel, upgraded`
- `Make every park decision sharper`
- `A premium parking assistant, not just extra settings`

## Implementation Phases

### Phase 1

- Add `Pro Center` as a dedicated in-app destination
- Improve Profile Pro card
- Add post-purchase confirmation and re-entry flow
- Tighten paywall copy around lifetime value

### Phase 2

- Make Notifications feel like a Pro radar workspace
- Add saved premium presets
- Improve confidence and clustering language

### Phase 3

- Expand Pro insights with trend summaries
- Add recommendation logic for timer presets
- Add more personal progress and quality signals

## Success Criteria

The Pro experience is good if:

- Users can describe what Pro changes without reading fine print
- Purchase completion feels like a mode unlock, not a receipt
- There is a clear place to return to after purchase
- Active Pro users see a different and more useful product layer
- Free users still have a strong core experience

## Constraints

- Keep all core community actions free
- Do not introduce physical-service gating
- Do not create a confusing mix of subscription language for a lifetime product
- Avoid adding too many new premium knobs without a clear user value story

## Related Research

- [Apple: Promote In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/promote-in-app-purchases/)
- [Apple: Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- [RevenueCat: Hard paywalls](https://www.revenuecat.com/docs/playbooks/guides/hard-paywall)
- [RevenueCat: Customer Center](https://www.revenuecat.com/docs/tools/customer-center)
- [RevenueCat: Paywalls](https://www.revenuecat.com/docs/tools/paywalls)

