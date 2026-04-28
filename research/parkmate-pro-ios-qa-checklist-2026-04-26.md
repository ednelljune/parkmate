# ParkMate Pro Lifetime iOS QA Checklist

Date: 2026-04-26
Product: `parkmate_pro_lifetime`
Entitlement: `pro`
Bundle ID: `com.parkmate.mobile`

## Preconditions

- `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` is set in the local app environment.
- RevenueCat product `parkmate_pro_lifetime` exists.
- RevenueCat entitlement `pro` exists.
- RevenueCat offering `default` includes the lifetime package.
- The Apple in-app purchase is attached to the app in App Store Connect.
- A Sandbox Apple test account is available on the test device.

## Build Validation

- [ ] Install a fresh iOS build on device or simulator with StoreKit test coverage if used.
- [ ] Confirm the app launches without a RevenueCat configuration error.
- [ ] Confirm the profile screen loads and shows the ParkMate Pro entry card.

## Paywall Entry Points

- [ ] Open Pro from Profile and confirm the paywall appears.
- [ ] Open the paywall by selecting a Pro radius in Notifications.
- [ ] Open the paywall by selecting `Best chance` sort in Notifications.
- [ ] Open the paywall by selecting a Pro reminder preset in Timer.

## Purchase Flow

- [ ] Purchase `parkmate_pro_lifetime` from the paywall.
- [ ] Confirm purchase completes without app restart.
- [ ] Confirm the paywall dismisses after success.
- [ ] Confirm Profile shows active Pro status.
- [ ] Confirm locked Pro insights on Profile are now visible.

## Feature Unlock Checks

- [ ] In Notifications, confirm `500m`, `1km`, and `2km` can be selected.
- [ ] In Notifications, confirm `Best chance` sort can be selected.
- [ ] In Timer, confirm Pro reminder presets can be selected and persisted.
- [ ] Restart the app and confirm Pro access remains unlocked.

## Restore Flow

- [ ] Sign out and sign back in if user identity is tied to auth state.
- [ ] Use `Restore purchases` from the paywall.
- [ ] Confirm Pro access returns without requiring a new purchase.

## Failure Cases

- [ ] Cancel the purchase sheet and confirm the app stays stable.
- [ ] Disable network during restore and confirm a user-visible failure state appears.
- [ ] Trigger the paywall on a build with no Apple key and confirm purchase actions are disabled with a configuration notice.

## Analytics To Verify

- [ ] Paywall presented from `profile_membership`
- [ ] Paywall presented from `radius_upgrade`
- [ ] Paywall presented from `premium_sort_mode`
- [ ] Paywall presented from `custom_timer_reminders`
- [ ] Purchase started
- [ ] Purchase succeeded
- [ ] Restore started
- [ ] Restore succeeded

## Android Follow-up

- Add `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`.
- Mirror the same checks on Android after the Play Billing product is configured.
