# ParkMate Pro Lifetime Spec

Date: 2026-04-26

## Goal

Launch a one-time paid upgrade for ParkMate that improves parking decision quality and convenience without putting core community trust loops behind a paywall.

The first release should unlock digital premium features only:

- Better alert control
- Better parking intelligence presentation
- Better timer controls
- Better profile insights

It should not charge for real-world parking, reservations, or any physical/offline service.

## Product Definition

- Product name: `ParkMate Pro Lifetime`
- Store type: non-consumable in-app purchase
- RevenueCat product id: `parkmate_pro_lifetime`
- RevenueCat entitlement id: `pro`
- Launch price: `A$19.99`
- Standard price after launch: `A$29.99`

Core promise:

`Smarter parking for life. One payment. No subscription.`

## Current App Surfaces

These app surfaces already exist and are the right premium entry points:

- Fixed alert radius in [anything/apps/mobile/src/constants/detectionRadius.js](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/constants/detectionRadius.js:1)
  Current default is `300m`
- Nearby report and zone radar in [anything/apps/mobile/src/app/(tabs)/notifications.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/notifications.jsx:1)
- Main live parking map, reports, claims, and directions in [anything/apps/mobile/src/app/(tabs)/index.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/index.jsx:1)
- Parking timer with scheduled reminders in [anything/apps/mobile/src/app/(tabs)/timer.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/timer.jsx:1)
- Profile, reputation, totals, and leaderboard rank in [anything/apps/mobile/src/app/(tabs)/profile.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/profile.jsx:1)

Important constraint:

- `react-native-purchases` and `react-native-purchases-ui` are installed, but there is currently no purchase integration in app code yet.

## Free vs Pro

### Free

- View nearby parking reports
- View nearby parking zones
- Report a spot
- Claim a spot
- Flag a false report
- Open a zone or spot on the map
- Use the base parking timer
- Receive default timer reminders
- View leaderboard rank, total reports, total claims, and progression
- Use the default nearby detection radius

### Pro Lifetime

- Choose a custom parking alert radius
- Unlock premium parking radar controls
- Unlock smarter parking signal sorting and clustering
- Unlock enhanced timer reminder controls
- Unlock deeper profile and contribution insights
- Remove ads later if ads are ever introduced

## Launch Scope

Launch scope should stay narrow and ship what can be supported cleanly with the current app.

### In scope for v1

- RevenueCat configuration
- Persistent entitlement fetch and caching
- Purchase flow
- Restore purchases flow
- Paywall modal or full-screen paywall
- One premium radius control
- One premium intelligence surface in notifications
- One premium timer upgrade
- One premium profile insights section

### Explicitly out of scope for v1

- Subscription products
- Selling physical parking access
- Reserved or guaranteed parking
- Paying to report, claim, or flag spots
- City packs
- Credits or consumables
- Saved commute zones if persistent data model does not yet exist
- Unlimited concurrent smart alerts if the alert system is not yet modeled in app state/backend

## Recommended Premium Features For V1

Keep the first release focused on upgrades that are easy to explain and easy to enforce.

### 1. Custom Alert Radius

Current state:

- Radius is fixed at `300m`

Free:

- Uses the default `300m` radius only

Pro:

- User can choose radius presets
- Suggested presets: `300m`, `500m`, `1km`, `2km`

Implementation notes:

- Replace the constant-only consumption pattern with a user setting plus fallback default
- Apply the chosen radius to:
  - notifications radar
  - map detection overlays
  - nearby reports/zones queries

Suggested gating point:

- When the user taps a radius control larger than `300m`, open the paywall if entitlement is missing

### 2. Premium Parking Intelligence

Current state:

- Notifications already show nearby reports and mention high-confidence clusters when quantity is greater than one

Free:

- Standard feed sorting by proximity

Pro:

- Add a premium sort mode that prioritizes recent, multi-report, high-confidence openings
- Add premium cluster emphasis in the radar UI
- Add a small `Pro` marker on premium sorting mode, not on the whole screen

Suggested gating points:

- Tapping `Best chance`
- Tapping `High-confidence view`

Important:

- Do not hide nearby reports entirely from free users
- Only improve ranking and clustering for Pro users

### 3. Enhanced Timer Controls

Current state:

- Timer already supports reminder scheduling and manual hour selection
- Reminder schedule is currently fixed by the app

Free:

- Existing timer behavior
- Existing reminder timing

Pro:

- Choose reminder timing presets
- Suggested presets:
  - `30m + 15m`
  - `20m + 10m`
  - `15m + 5m`
  - `Final warning only`

Suggested gating points:

- When the user tries to change reminder behavior
- When the user taps a `Custom reminders` control

Important:

- Do not gate the timer itself
- The timer is too core to the app flow after a claimed spot

### 4. Advanced Profile Insights

Current state:

- Profile already shows contribution score, leaderboard rank, total reports, total claims, and progress to next tier

Free:

- Existing profile metrics

Pro:

- Add a new premium insights card with derived metrics:
  - claim conversion rate
  - contribution streak
  - trust trend over the last 7 or 30 days
  - report quality summary if enough data exists

Suggested gating points:

- Tapping `Insights`
- Tapping a locked premium metric card

Important:

- Keep base reputation and leaderboard public to preserve the community loop

## Features To Leave Free

These should remain free permanently unless the product strategy changes substantially:

- Viewing nearby map activity
- Reporting a spot
- Claiming a spot
- Flagging a false report
- Viewing basic zone information
- Starting the timer after claiming
- Seeing base profile reputation and leaderboard placement

Reason:

Those actions feed map quality and trust. Charging for them would weaken the core data flywheel.

## RevenueCat Setup

Create these objects in RevenueCat:

- Entitlement: `pro`
- Offering: `default`
- Package: lifetime
- Product: `parkmate_pro_lifetime`

Recommended app behavior:

- Configure RevenueCat once at app startup
- Log in with the app user id when authenticated
- Log out RevenueCat user state on sign-out
- Cache customer info locally
- Expose a single `hasPro` boolean to the app

## App Integration Shape

Add a purchase layer with three responsibilities:

1. Bootstrapping

- Configure RevenueCat keys per platform
- Bind RevenueCat user identity to the authenticated user when available

2. Entitlement state

- Fetch customer info
- Derive `hasPro`
- Refresh on app foreground
- Refresh after purchase or restore

3. Paywall control

- Open paywall from feature gates
- Purchase selected package
- Restore purchases
- Handle cancel, pending, and purchased outcomes cleanly

## Suggested File Additions

These file names are recommendations for implementation:

- `anything/apps/mobile/src/lib/purchases/config.ts`
- `anything/apps/mobile/src/lib/purchases/client.ts`
- `anything/apps/mobile/src/lib/purchases/entitlements.ts`
- `anything/apps/mobile/src/hooks/useProAccess.ts`
- `anything/apps/mobile/src/components/paywall/ProPaywall.jsx`
- `anything/apps/mobile/src/components/paywall/LockedFeatureCard.jsx`
- `anything/apps/mobile/src/constants/proFeatures.ts`

## Suggested File Changes

Expected launch touchpoints:

- [anything/apps/mobile/src/app/_layout.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/_layout.jsx:1)
  Initialize purchase provider at app startup
- [anything/apps/mobile/src/app/(tabs)/notifications.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/notifications.jsx:1)
  Add premium radius control and premium sort/filter entry point
- [anything/apps/mobile/src/app/(tabs)/index.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/index.jsx:1)
  Consume selected radius instead of fixed constant where appropriate
- [anything/apps/mobile/src/app/(tabs)/timer.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/timer.jsx:1)
  Gate custom reminder controls
- [anything/apps/mobile/src/app/(tabs)/profile.jsx](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/src/app/(tabs)/profile.jsx:1)
  Add premium insights panel

## Gating Rules

Use event-driven gating instead of aggressive interruption.

### Notifications screen

- Free users can open the screen and use the standard feed
- If free user selects radius above `300m`, show paywall
- If free user selects premium sort mode, show paywall

### Timer screen

- Free users can start, pause, resume, and reset timers
- If free user opens custom reminder controls, show paywall

### Profile screen

- Free users can see current metrics
- If free user opens premium insights, show paywall

### Map screen

- Free users can view nearby data normally
- If radius selection is exposed on map, the same radius gate applies there too

## Paywall UX

Use a simple, utility-first paywall.

### Headline

`Unlock smarter parking for life`

### Subhead

`One payment. No subscription.`

### Top three bullets

- `Custom alert radius`
- `Premium parking intelligence`
- `Advanced timer controls`

### CTA

`Unlock ParkMate Pro`

### Secondary actions

- `Restore purchases`
- `Maybe later`

### Placement rules

- Do not show on first launch
- Show only after a user hits a genuine premium boundary
- Prefer contextual paywalls over generic interruptions

## Analytics Events

Track at minimum:

- `paywall_viewed`
- `paywall_dismissed`
- `paywall_purchase_started`
- `paywall_purchase_succeeded`
- `paywall_purchase_failed`
- `paywall_restore_started`
- `paywall_restore_succeeded`
- `paywall_restore_failed`
- `pro_gate_hit`

Recommended event properties:

- `gate_name`
- `screen_name`
- `product_id`
- `offering_id`
- `has_pro`
- `platform`

Suggested `gate_name` values:

- `radius_upgrade`
- `premium_sort_mode`
- `custom_timer_reminders`
- `profile_insights`

## Launch Acceptance Criteria

The v1 launch is ready when:

- A signed-in user can purchase `ParkMate Pro Lifetime`
- A returning user keeps `pro` access after reinstall and restore
- `hasPro` is available app-wide from one source of truth
- Free users can still use the core map, reporting, claiming, and timer flows
- Premium gates open the paywall only when premium features are requested
- The purchase state updates immediately after successful purchase or restore

## Risks

### Product risk

- If the paywall is shown too early, conversion may be lower because users have not experienced the core value yet

### UX risk

- If free value is too constrained, the app may feel crippled rather than upgraded

### Engineering risk

- Radius changes touch multiple query surfaces, so radius state must be centralized

### Data risk

- Advanced profile insights may require derived metrics not currently exposed by backend endpoints

## Recommended Delivery Sequence

### Phase 1

- RevenueCat setup
- App-wide entitlement state
- Paywall component
- Purchase and restore flows

### Phase 2

- Premium radius control
- Notifications premium sorting mode

### Phase 3

- Timer reminder customization
- Premium profile insights

### Phase 4

- Price test from `A$19.99` to `A$29.99`
- Refine paywall copy and trigger timing based on conversion

## Policy Notes

This plan is intentionally framed around digital in-app features rather than physical parking services. That keeps the monetization model aligned with Apple and Google guidance for in-app purchases and one-time digital upgrades.

Reference links:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple in-app purchase pricing: https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/set-a-price-for-an-in-app-purchase/
- Google Play one-time products: https://developer.android.com/google/play/billing/one-time-products
- Google Play payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
