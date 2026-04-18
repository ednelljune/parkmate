# ParkMate UAT Test Cases

Status values:
- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT RUN`

Suggested execution fields per run:
- Tester
- Device / OS
- Build number
- Date
- Status
- Notes

## PM-UAT-001 to PM-UAT-006: App Launch / First Run

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-001 | App installs successfully | Install the app on a supported device. | Installation completes without error. | NOT RUN | |
| PM-UAT-002 | App opens without crash | Launch the app after install. | App opens and remains stable. | NOT RUN | |
| PM-UAT-003 | Splash or loading screen completes | Open the app from a cold start. | Splash/loading screen appears briefly, then transitions normally. | NOT RUN | |
| PM-UAT-004 | Expected first screen loads | Launch the app as a new or signed-out user. | The correct landing screen is shown for the user state. | NOT RUN | |
| PM-UAT-005 | First-load layout is intact | Review the first visible screen on supported screen sizes. | No overlapping, clipped, or broken UI appears. | NOT RUN | |
| PM-UAT-006 | Portrait sizes behave correctly | Repeat first-run checks on at least two portrait screen sizes. | Core layout remains usable on both devices. | NOT RUN | |

## PM-UAT-007 to PM-UAT-015: Sign Up / Login / Logout

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-007 | New user can sign up | Open sign-up, enter valid name, email, and password, then submit. | Account creation succeeds. | NOT RUN | |
| PM-UAT-008 | Empty-field validation appears | Submit sign-up or login with required fields left blank. | Clear validation messages are shown. | NOT RUN | |
| PM-UAT-009 | Short-password validation appears | Attempt sign-up with a password below the minimum length. | A clear password validation error is shown. | NOT RUN | |
| PM-UAT-010 | Existing user can log in | Enter valid existing credentials and submit. | Login succeeds and the authenticated experience loads. | NOT RUN | |
| PM-UAT-011 | Incorrect login shows clear error | Enter invalid credentials and submit. | A clear authentication error is shown. | NOT RUN | |
| PM-UAT-012 | Confirmed-email flow works | Complete the app's expected email-confirmation flow if required. | User can access the app as intended after confirmation. | NOT RUN | |
| PM-UAT-013 | Session persists after restart | Log in, terminate the app, then reopen it. | User remains signed in. | NOT RUN | |
| PM-UAT-014 | User can log out | Open logout from the authenticated app and confirm. | User is signed out successfully. | NOT RUN | |
| PM-UAT-015 | Logged-out access is restricted | Attempt to reach authenticated flows after logout. | Protected screens and actions are blocked. | NOT RUN | |

## PM-UAT-016 to PM-UAT-020: Location Permissions

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-016 | Location permission prompt timing | Trigger a location-dependent map flow on first use. | Permission prompt appears at the appropriate time. | NOT RUN | |
| PM-UAT-017 | Granting location enables features | Allow location access when prompted. | Map and nearby features activate correctly. | NOT RUN | |
| PM-UAT-018 | Denying location is handled | Deny location permission. | The app shows a clear fallback state or message. | NOT RUN | |
| PM-UAT-019 | Location unavailable does not crash app | Simulate unavailable location services. | App remains stable and shows a usable state. | NOT RUN | |
| PM-UAT-020 | Re-enabling location restores functionality | Re-enable location in device settings and return to the app. | Location-dependent functionality resumes correctly. | NOT RUN | |

## PM-UAT-021 to PM-UAT-029: Home Map / Live Map

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-021 | Map loads correctly | Open the main map screen. | Map renders without error. | NOT RUN | |
| PM-UAT-022 | Current location is shown | Allow location and observe the map. | Current location indicator appears correctly. | NOT RUN | |
| PM-UAT-023 | Recenter returns to user | Pan away, then tap recenter. | Map returns to the current location. | NOT RUN | |
| PM-UAT-024 | Live movement updates correctly | Move physically or simulate movement. | Map position updates appropriately. | NOT RUN | |
| PM-UAT-025 | Manual map movement is stable | Pan and zoom repeatedly. | Manual interaction remains smooth and consistent. | NOT RUN | |
| PM-UAT-026 | Parking zones appear nearby | View an area with mapped parking zones. | Nearby zones display on the map. | NOT RUN | |
| PM-UAT-027 | Reported spots appear nearby | View an area with active user reports. | Nearby reported spots display on the map. | NOT RUN | |
| PM-UAT-028 | Marker density remains usable | Test an area with multiple nearby markers. | Marker UI remains tappable and understandable. | NOT RUN | |
| PM-UAT-029 | Map remains responsive over time | Leave the map open and interact over several minutes. | Performance remains acceptable. | NOT RUN | |

## PM-UAT-030 to PM-UAT-035: Parking Zone Details

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-030 | Zone details modal opens | Tap a parking zone marker. | Zone details modal opens. | NOT RUN | |
| PM-UAT-031 | Zone name and type are correct | Review the opened zone modal. | Displayed zone name and parking type are correct. | NOT RUN | |
| PM-UAT-032 | Zone rules or description render correctly | Review any rules/description text in the modal. | Information displays clearly and accurately. | NOT RUN | |
| PM-UAT-033 | Zone capacity displays when available | Open a zone that includes capacity metadata. | Capacity appears correctly when present. | NOT RUN | |
| PM-UAT-034 | Zone available reports are correct | Compare displayed available reports against live data on the map. | Counts/details match the current zone state. | NOT RUN | |
| PM-UAT-035 | Closing zone modal returns cleanly | Close the zone modal. | User returns to the map without stale UI. | NOT RUN | |

## PM-UAT-036 to PM-UAT-044: Report a Parking Spot

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-036 | Report flow opens | Open the Report Parking Spot flow from the map. | Reporting UI opens successfully. | NOT RUN | |
| PM-UAT-037 | Only nearby valid zones are offered | Start a report where one or more nearby valid zones exist. | Only nearby eligible zones/options appear. | NOT RUN | |
| PM-UAT-038 | User can select zone and parking type | Move through the reporting flow and choose options. | Selection works correctly. | NOT RUN | |
| PM-UAT-039 | User can adjust spot quantity | Increase and decrease the reported quantity. | Quantity updates correctly. | NOT RUN | |
| PM-UAT-040 | Report blocked when no nearby zone exists | Attempt to report outside valid mapped-zone range. | Submission is blocked with a clear message. | NOT RUN | |
| PM-UAT-041 | Successful report appears on map | Submit a valid report and return to the map. | New report appears on the map. | NOT RUN | |
| PM-UAT-042 | Successful report appears in Activity | Submit a valid report and open Activity. | Report event appears in Activity. | NOT RUN | |
| PM-UAT-043 | Report data is correct | Verify zone, type, and quantity after submission. | Report reflects the chosen values. | NOT RUN | |
| PM-UAT-044 | Duplicate taps do not create duplicate reports | Tap submit multiple times quickly during report creation. | Only one report is created. | NOT RUN | |

## PM-UAT-045 to PM-UAT-054: Spot Details / Claim / False Report / Delete

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-045 | Spot details modal opens | Tap an available reported spot. | Spot details open successfully. | NOT RUN | |
| PM-UAT-046 | Spot detail values are correct | Review zone, distance, time left, and status for an open spot. | All displayed values are correct. | NOT RUN | |
| PM-UAT-047 | Another user can claim an available spot | Sign in as a second user and claim an available spot. | Claim succeeds. | NOT RUN | |
| PM-UAT-048 | Claimed spot status updates correctly | Claim a spot, then refresh related screens. | Spot status updates consistently across surfaces. | NOT RUN | |
| PM-UAT-049 | User can file a false spot report | Open a report created by another user and submit a false report. | False report submission succeeds. | NOT RUN | |
| PM-UAT-050 | False spot threshold requires 3 distinct users | Have three different users flag the same spot as false. | Trust-score impact is only applied on the third distinct false report. | NOT RUN | |
| PM-UAT-051 | User can delete own report | Open a report created by the signed-in user and delete it. | Delete succeeds. | NOT RUN | |
| PM-UAT-052 | User cannot delete someone else's report | Open another user's report and attempt deletion if exposed. | Deletion is not allowed. | NOT RUN | |
| PM-UAT-053 | Expired or claimed spots behave correctly | Open spots in claimed and expired states. | Actions and state presentation are correct for each status. | NOT RUN | |
| PM-UAT-054 | Spot actions show loading states | Trigger claim, false report, and delete actions. | Progress/loading states appear correctly and prevent bad double actions. | NOT RUN | |

## PM-UAT-055 to PM-UAT-059: Directions / Navigation

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-055 | Directions launches successfully | Open directions from a supported zone or spot. | Navigation launches successfully. | NOT RUN | |
| PM-UAT-056 | In-app route displays correctly | Use an environment where in-app routing is supported. | Route is drawn correctly. | NOT RUN | |
| PM-UAT-057 | External fallback works | Force or simulate a route failure for Google/in-app navigation. | External navigation fallback works. | NOT RUN | |
| PM-UAT-058 | Navigation works for zones and spots | Test directions from both a parking zone and a reported spot. | Navigation works in both cases. | NOT RUN | |
| PM-UAT-059 | Route clears after navigation ends | Cancel or finish navigation. | Route overlay or navigation state clears correctly. | NOT RUN | |

## PM-UAT-060 to PM-UAT-066: Nearby Alerts Screen

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-060 | Nearby alerts loads | Open the Nearby Alerts screen. | Screen loads without error. | NOT RUN | |
| PM-UAT-061 | Alert filters work | Switch between All, Reports, and Zones tabs. | Filtering updates the list correctly. | NOT RUN | |
| PM-UAT-062 | Alert distances are reasonable | Compare displayed distances with map position. | Distances are plausible and consistent. | NOT RUN | |
| PM-UAT-063 | Time remaining updates correctly | Observe report timers over time. | Remaining time updates accurately. | NOT RUN | |
| PM-UAT-064 | Opening an alert targets the correct map item | Tap a nearby alert item. | App opens the correct map target. | NOT RUN | |
| PM-UAT-065 | Empty state is handled cleanly | Open the screen with no nearby alerts available. | Clear empty state is shown. | NOT RUN | |
| PM-UAT-066 | Pull-to-refresh works | Refresh the Nearby Alerts screen manually. | Data reloads correctly. | NOT RUN | |

## PM-UAT-067 to PM-UAT-075: Push Notifications / Local Alerts

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-067 | Notification permission prompt timing | Trigger the app's notification permission flow. | Permission is requested at the expected time. | NOT RUN | |
| PM-UAT-068 | Notification denial is handled | Deny notification permissions. | App continues to function with a graceful fallback. | NOT RUN | |
| PM-UAT-069 | Nearby parking alerts trigger correctly | Enter a condition that should fire a nearby alert. | Notification triggers as expected. | NOT RUN | |
| PM-UAT-070 | Notification content matches the event | Review the delivered alert. | Zone/spot details in the notification are correct. | NOT RUN | |
| PM-UAT-071 | Tapping a notification deep-links correctly | Tap a delivered notification. | App opens the correct screen or item. | NOT RUN | |
| PM-UAT-072 | Duplicate notifications are not sent | Reproduce the same event repeatedly or refresh rapidly. | Duplicate notifications are avoided. | NOT RUN | |
| PM-UAT-073 | System updates notify claimed, expired, or flagged reports | Trigger claim, expiry, and false-report update scenarios. | Correct system update notifications appear. | NOT RUN | |
| PM-UAT-074 | Android notification channel behavior is correct | Validate channel behavior on Android. | Notifications use the expected Android channel behavior. | NOT RUN | |
| PM-UAT-075 | iOS notification behavior is correct | Validate foreground/background notification behavior on iPhone. | iOS behavior matches expected app behavior. | NOT RUN | |

## PM-UAT-076 to PM-UAT-086: Activity / Mailbox

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-076 | Activity feed loads | Open Activity or mailbox. | Feed loads without error. | NOT RUN | |
| PM-UAT-077 | User-reported actions appear | Create a report and open Activity. | Reported action appears. | NOT RUN | |
| PM-UAT-078 | Claimed actions appear | Claim a spot and open Activity. | Claimed action appears. | NOT RUN | |
| PM-UAT-079 | False-report actions appear | File a false report and open Activity. | False-report action appears. | NOT RUN | |
| PM-UAT-080 | System updates appear correctly | Trigger system update events and review mailbox. | Update entries appear with correct messaging. | NOT RUN | |
| PM-UAT-081 | Unread count updates correctly | Generate unread items and then view them. | Unread counts update accurately. | NOT RUN | |
| PM-UAT-082 | Mark all read works | Use Mark all read on a feed with unread items. | All relevant items become read. | NOT RUN | |
| PM-UAT-083 | Individual read/unread actions work | Mark a single item read or unread where supported. | State updates correctly. | NOT RUN | |
| PM-UAT-084 | Delete single activity item works | Delete an individual feed item. | Item is removed as expected. | NOT RUN | |
| PM-UAT-085 | Delete all activity items works | Use delete-all behavior where supported. | Feed clears as expected. | NOT RUN | |
| PM-UAT-086 | Swipe actions are smooth | Exercise swipe actions on feed rows. | Swipe UX is stable and usable. | NOT RUN | |

## PM-UAT-087 to PM-UAT-096: Parking Timer

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-087 | Timer screen loads | Open the parking timer screen. | Screen loads correctly. | NOT RUN | |
| PM-UAT-088 | User can select 1P, 2P, and 3P | Choose each common duration option. | Selection works correctly. | NOT RUN | |
| PM-UAT-089 | Timer starts | Start a timer. | Countdown begins correctly. | NOT RUN | |
| PM-UAT-090 | Timer pauses | Pause an active timer. | Timer pauses correctly. | NOT RUN | |
| PM-UAT-091 | Timer resumes | Resume a paused timer. | Timer resumes correctly. | NOT RUN | |
| PM-UAT-092 | Timer resets | Reset an active or paused timer. | Timer resets correctly. | NOT RUN | |
| PM-UAT-093 | Timer survives app restart | Start a timer, close the app, then reopen it. | Timer state persists correctly. | NOT RUN | |
| PM-UAT-094 | Reminder notifications trigger | Use a timer scenario that should produce reminders. | Reminders are delivered at expected times. | NOT RUN | |
| PM-UAT-095 | Expiry state is clear | Allow a timer to expire. | Expired state is clear and correct. | NOT RUN | |
| PM-UAT-096 | Navigation-param timer behavior works | Open the timer via any supported deep-link or navigation-param flow. | Timer initializes as expected. | NOT RUN | |

## PM-UAT-097 to PM-UAT-102: Leaderboard

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-097 | Leaderboard loads | Open the leaderboard screen. | Screen loads without error. | NOT RUN | |
| PM-UAT-098 | Top users are in correct order | Review the ranked leaderboard list. | Ordering is correct. | NOT RUN | |
| PM-UAT-099 | Contribution and trust values look correct | Compare displayed values against known user data. | Values are correct. | NOT RUN | |
| PM-UAT-100 | Leaderboard refresh works | Trigger a refresh. | Data refreshes successfully. | NOT RUN | |
| PM-UAT-101 | Empty and error states are handled | Test with empty or failing data conditions if possible. | UI handles those states clearly. | NOT RUN | |
| PM-UAT-102 | Current user data is reflected correctly | Review the leaderboard as a signed-in user who should appear or be referenced. | Signed-in user data is reflected correctly. | NOT RUN | |

## PM-UAT-103 to PM-UAT-110: Profile

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-103 | Profile loads | Open the profile screen. | Profile renders correctly. | NOT RUN | |
| PM-UAT-104 | Name, email, and initials are correct | Review the header/user identity details. | User identity displays correctly. | NOT RUN | |
| PM-UAT-105 | Contribution points are correct | Compare profile points with known account data. | Contribution points are accurate. | NOT RUN | |
| PM-UAT-106 | Total reports and claims are correct | Compare displayed totals with known user activity. | Totals are accurate. | NOT RUN | |
| PM-UAT-107 | Rank or tier badge is correct | Review the user's displayed badge/tier. | Badge/tier matches expected state. | NOT RUN | |
| PM-UAT-108 | Tier progress updates correctly | Perform an action that should affect progress and refresh the profile. | Progress updates correctly. | NOT RUN | |
| PM-UAT-109 | Logout works from profile | Trigger logout from the profile screen. | Logout completes successfully. | NOT RUN | |
| PM-UAT-110 | New-user profile has no broken UI | Open profile for a new or low-activity user. | Empty/low-data UI remains clean and usable. | NOT RUN | |

## PM-UAT-111 to PM-UAT-117: Error Handling / Resilience

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-111 | Poor network does not crash app | Use a poor or unstable connection during normal use. | App remains stable. | NOT RUN | |
| PM-UAT-112 | Loading indicators appear | Trigger major fetches across the app. | Appropriate loading indicators appear. | NOT RUN | |
| PM-UAT-113 | API failures show usable errors | Force or simulate failing API requests. | User sees clear, usable error messaging. | NOT RUN | |
| PM-UAT-114 | Empty states are clear | Open screens with no data. | Empty states are informative and usable. | NOT RUN | |
| PM-UAT-115 | Rapid taps do not break flows | Tap action buttons quickly in sensitive flows. | App prevents duplicate or broken states. | NOT RUN | |
| PM-UAT-116 | App recovers after backgrounding | Background the app mid-flow, then return. | App resumes without broken state. | NOT RUN | |
| PM-UAT-117 | App recovers after internet loss | Disconnect and reconnect internet during use. | App recovers cleanly after connectivity returns. | NOT RUN | |

## PM-UAT-118 to PM-UAT-124: Device / Platform Checks

| Test Case ID | Scenario | Steps | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| PM-UAT-118 | Android smoke test | Run core flows on Android. | Android core flows work. | NOT RUN | |
| PM-UAT-119 | iPhone smoke test | Run core flows on iPhone. | iPhone core flows work. | NOT RUN | |
| PM-UAT-120 | Different screen sizes render correctly | Repeat core screens on multiple device sizes. | Layout remains usable on all tested devices. | NOT RUN | |
| PM-UAT-121 | Safe-area spacing is correct | Review screens with top and bottom insets. | Safe-area padding looks correct. | NOT RUN | |
| PM-UAT-122 | Keyboard does not cover auth fields | Open login/sign-up and focus text fields. | Keyboard handling keeps fields accessible. | NOT RUN | |
| PM-UAT-123 | Notification behavior is correct on both platforms | Validate notification flows on Android and iPhone. | Behavior is correct on both platforms. | NOT RUN | |
| PM-UAT-124 | Maps render correctly on both platforms | Open map-based flows on Android and iPhone. | Maps render and behave correctly on both platforms. | NOT RUN | |

## Recommended Test Personas / Data Setups

| Persona ID | Scenario |
| --- | --- |
| PM-DATA-001 | Brand new user |
| PM-DATA-002 | Existing active user |
| PM-DATA-003 | User with multiple reports |
| PM-DATA-004 | User with claimed spots |
| PM-DATA-005 | User with false-reported or system-update activity |
| PM-DATA-006 | Device with location denied |
| PM-DATA-007 | Device with notifications denied |
| PM-DATA-008 | Low-connectivity or intermittent-network scenario |
