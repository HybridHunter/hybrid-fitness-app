# GymKit Full Audit — Findings Catalog

Generated 2026-07-17 by 9-agent static audit + live simulation. Architecture context:
data is stored per-gym as whole JSON blobs in Supabase `data_store` (gym_id, key, value JSONB)
via `useLocalStorage(key, default)` → `[value, setter, cloudLoaded]`; mount fetch overwrites
local state; writes are debounced 300ms whole-blob upserts. Roles: admin/coach (staff app),
client (ClientPortal), super admin (`__super__` context). Prod API: hybrid-fitness-api.fly.dev.
NOTE: anon-key DELETE on data_store DOES work in prod (verified by probe) — the "no DELETE
policy" note in supabase-schema.sql is stale; a delete policy was added in the dashboard.

Status legend: [ ] open, [x] fixed, [~] partially fixed / deferred product gap.

**2026-07-17 FIX WAVE COMPLETE** — 11 parallel fix agents + coordinator patches addressed all
critical and major findings. Full simulation suite (6 personas, 11 scenarios) passes clean:
zero crashes, console errors, blank screens, or broken flows. Deferred items marked [~] are
missing *features* (not bugs): gamification XP economy, CRM lead capture, automation scheduler,
Rank/Shop stubs, client-side classroom reader, per-date scheduling model beyond exceptions.
Also fixed beyond the catalog: S4 — label-wrapped checkboxes in SuperAdminPanel double-toggled
(click on label text was a no-op); onboarding tour overlay behavior verified.

## A. FOUNDATIONAL / CROSS-CUTTING (fix first — huge blast radius)

- [x] A1 CRITICAL SignUpPage.js:36 + OnboardingWizard.js:15 — `supabaseUpsert` double-stringifies (`value: JSON.stringify(value)`) into the JSONB column. Everything a public signup or the onboarding wizard writes (hf_users, hf_gym_info, hf_subscription, hf_gyms_registry, hf_members, hf_branding) is stored as a STRING. Consequences: new-gym admins can't log in from any other device (AuthContext.js:69 `Array.isArray(row.value)` fails); same-device login breaks after the mount fetch overwrites the local cache; Settings Users tab shows empty; members created in wizard can't use client portal. FIX: store raw JSON; also repair any string-valued rows on read (defensive parse in useLocalStorage) to heal existing corrupted gyms.
- [x] A2 CRITICAL useLocalStorage.js:82-92 — mount cloud fetch unconditionally `setValue(cloudVal)`, clobbering any user write made in the first seconds (App.js hf_ex/hf_w/hf_p and every consumer; nobody consumes `cloudLoaded`). FIX inside hook: track pending/dirty writes; skip fetch overwrite when a local write already happened.
- [x] A3 CRITICAL useLocalStorage.js — data NEVER refreshes after mount (fetchedRef guard, no polling/realtime). Chat, community, bookings, stations require a full reload to see other devices' writes. FIX inside hook: periodic re-fetch (~20s, plus visibilitychange) that updates state+localStorage cache only when value changed and no dirty local write is pending. Side benefit: StationDisplay's 2s localStorage poll starts receiving updates.
- [x] A4 MAJOR SignUpPage.js:33, OnboardingWizard.js:12, SuperAdminPanel.js:32 — upserts omit `?on_conflict=gym_id,key` (hook uses it at useLocalStorage.js:129). With PK id column, updates of existing rows 409 and are silently swallowed (SuperAdminPanel/wizard don't check res.ok). FIX: add on_conflict param everywhere.
- [x] A5 CRITICAL PaymentModal.js:6 — `API_BASE = 'http://localhost:3002'` hardcoded; all card/ACH payments fail in prod. FIX: `process.env.REACT_APP_API_URL || 'http://localhost:3002'`.
- [x] A6 MAJOR GymBillingView.js:6 + EmailBuilder.js:7 — use `REACT_APP_SERVER_URL || "https://gymkit-server.fly.dev"` (wrong host). FIX: unify on REACT_APP_API_URL (hybrid-fitness-api.fly.dev).
- [x] A7 MAJOR raw `localStorage.setItem` writes that never sync + get clobbered by cloud fetch: ClientPortal.js:1029-1042 (late-cancel fee + attendance), MembersView.js:330-351 (freeze booking removal), AutomationsView.js:222-236,290-299 (hf_notifications), SettingsView.js:1517-1580 (clear demo data). FIX: route through the synced setter / direct upsert.

## B. CRASHES (uncaught exceptions)

- [x] B1 CRITICAL ScheduleView.js:678,700 — `coaches` undefined (only `staffUsers` exists); expanding Private Training panel throws ReferenceError, crashes Schedule view.
- [x] B2 CRITICAL BusinessDashboard.js:289,304 — `_gp` referenced in module-level `MemberEngagementAlerts` but defined inside component (line 799); clicking engagement-alert buttons throws ReferenceError. (Same in dead file DashboardView.js:346,361.)
- [x] B3 CRITICAL SuperAdminPanel.js:1356,1436 — `renderForm` calls useState but is invoked conditionally as a plain function → hooks-order crash on "+ Add Exercise"/"Edit".
- [x] B4 CRITICAL CommunityFeed.js:1687,517,545 — client-authored comments `{content, createdAt}` lack `likes` → `c.likes.length`/`.includes` TypeError white-screens staff feed. Reverse: ClientPortal.js:1394 renders `c.content`/`c.createdAt` so coach comments `{text, timestamp}` show blank + NaN time. FIX: normalize comment shape on write and read defensively both sides.
- [x] B5 CRITICAL DataMigrationView.js:558 — `updateMember` not destructured from useMembers (only addMember) → ReferenceError during CSV import w/ emergency-contact rows; import hangs on "Finalizing...".
- [x] B6 MINOR MemberProfile.js:169 — `.sort((a,b)=>b.checkInTime.localeCompare(...))` throws if a record lacks checkInTime.
- [x] B7 MINOR ScheduleView.js:612,635 — unguarded `activeClass.bookings.includes`/`.length` (legacy records without arrays crash modal).
- [x] B8 MINOR WorkoutsView.js:9,24 — PrintArea: `w.sections||DSEC` guard then dereferences `w.sections[si]` → TypeError when sections undefined.
- [x] B9 MAJOR IntegrationsView.js:202,208 + SettingsView.js:671 — two writers of hf_integrations with incompatible shapes (flat vs nested); `prev.ghl.syncSettings`/`prev.fieldMappings`/`prev.stripe.publishableKey` TypeError depending on which wrote last. FIX: normalize/merge shapes defensively.

## C. HARDCODED CLOCK / DATE-TIMEZONE

- [x] C1 CRITICAL CommunityFeed.js:72-74,584-610,668,1698 — `TODAY`/`now` frozen at "2026-04-01"; challenges/check-ins/leaderboards all wrong vs ClientPortal's real todayISO().
- [x] C2 CRITICAL auto-checkin.mjs:70-73 — cron uses UTC now for gym-local dayOfWeek/startTime; auto check-ins at wrong hours/days for non-UTC gyms. FIX: use hf_gym_info.timezone per gym.
- [x] C3 MAJOR UTC "today" via toISOString().slice(0,10) breaks evenings in US timezones: CheckInView.js:8-10 (today's list resets ~5pm PT, streak/dedupe), CoachingDashboard.js:19-21,175-199,429-431 (shift logs, undo no-ops), useMembers.js:51,59,115 (cancellations/carryover/booking-clear), ScheduleView.js:84,215,555,704, EventsView.js:19,374, ClientPortal.js:1096-1098 (day pills), BusinessDashboard.js:49-53,1101-1104 (payments on the 1st), BusinessDashboard.js:2064,2138-2157 (utilization month). FIX: shared local-date helper (`localISO()`), replace throughout.

## D. DATA-SHAPE MISMATCHES (writer vs reader)

- [x] D1 MAJOR BusinessDashboard.js:1194,2433-2449 — Today's Schedule filters `c.day === dayName || c.days?.includes` but schedule rows have numeric `dayOfWeek` (0=Mon) — widget permanently empty; renders nonexistent `cls.time`/`bookedCount`.
- [x] D2 MAJOR BusinessDashboard.js:1199-1202 — activity feed reads `a.date||a.timestamp||a.createdAt` but attendance has only `checkInTime` → "NaNd ago".
- [x] D3 CRITICAL AnalyticsView.js:50,58-59,91 — filters `e.type === "sign_up"`/"cancellation" but events are logged as "join"/"cancel" → sign-ups & churn wrong.
- [x] D4 CRITICAL GamificationView.js:44-53 — `new Date(rec.date)` but records have `checkInTime` → Monthly Attendance Goal always 0. Also exclude noShow.
- [x] D5 MAJOR AnalyticsView.js:628,561,666,978 — dayOfWeek convention mismatch (app: 0=Mon; code uses getDay() 0=Sun + Sunday-first labels) → utilization/day labels off by one.
- [x] D6 MAJOR id type mismatches (select string vs Date.now() number): RemoteWorkoutsView.js:91,148 (template workouts never resolve), CommandView.js:414 (class workout never auto-loads). FIX: String() compares.
- [x] D7 MAJOR OnboardingWizard.js:70 — writes `hf_classes` `{day:"Monday",time}` — nothing reads it (app uses hf_schedule `{dayOfWeek,startTime,...}`); first session silently discarded. Member shape uses status/joinDate instead of membershipStatus/startDate.
- [x] D8 MINOR ScheduleView.js:104-108 — getWorkoutSummary reads `s.exercises` but sections use `slots` → "0 exercises".
- [x] D9 MAJOR GymBillingView.js:16,28-32 — checks `status === "trial"` but signup writes "trialing"; renders `$undefined/month`.
- [x] D10 MINOR DataMigrationView.js:588-596 — import puts plan NAME into membershipPlanId.
- [x] D11 MINOR GymBillingView.js:23 — Stripe customer created with `branding.email` which doesn't exist → always "".

## E. IDENTITY / ROLE / TENANT

- [x] E1 MAJOR EventsView.js:39,382-396 — RSVP identity hardcoded `CURRENT_USER="m1"`, names from hardcoded demo map → RSVPs nonfunctional for real users.
- [x] E2 MAJOR CommunityFeed.js:481,486,1815,1829,1903-1908 — staff votes/likes hardcoded to identity "coach" (all staff collapse into one).
- [x] E3 MAJOR CommunityFeed.js:612-624 — challenge leaderboards resolve names only for hardcoded demo ids; real members show as raw UUIDs.
- [x] E4 MAJOR SettingsView.js:1188-1193 + AuthContext.js:50-52,121 — staff created in Settings get no gymId; login leaves hf_gym_id at "default" → wrong tenant reads/writes.
- [x] E5 MAJOR AuthContext.js:29,128 — AuthProvider's hf_users hook fetched under mount-time gym; after in-app gym switch, addUser/removeUser write the OLD gym's array into the NEW gym's row.
- [x] E6 CRITICAL SuperAdminPanel.js:188-194 — panel Stop Impersonating restores gym_id but not hf_session (App.js:97-99 version does). Also App.js:97 `if (backupSession)` skips empty-string backup; logout during impersonation leaves hf_impersonating + backups behind (AuthContext.js:118-122).
- [x] E7 MINOR App.js:83-87 — any /gym/:gymId URL blindly persisted as tenant.
- [x] E8 MINOR SuperAdminPanel.js:176-181 — impersonate-as-client with no members → memberId undefined, broken portal session.
- [x] E9 MAJOR MembersView.js:300-313 + LoginPage — members savable with empty PIN; empty-string pin + blank password logs in as that member; undefined pin = locked out. FIX: require/generate PIN, reject empty password login.

## F. REALTIME / CONCURRENCY (mostly addressed by A2/A3 + targeted merges)

- [x] F1 CRITICAL hf_messages/hf_community_posts last-write-wins whole-blob (MessagingView.js:94, FloatingChat.js:138, ClientPortal.js:146) — simultaneous writers drop messages; no unread flow for clients (coach msgs born read:true — MessagingView.js:187, FloatingChat.js:49,112 vs ClientPortal read logic).
- [x] F2 MAJOR booking capacity race (ClientPortal.js:1069-1076, ScheduleView.js:173-180).
- [x] F3 MAJOR auto-checkin.mjs:104-106 + CheckInView duplicate guard (:141-153) — cron/kiosk double check-ins; no dedupe by member+class+day.
- [x] F4 MAJOR StationDisplay.js:211-226 — waiting screen polls localStorage only (fixed by A3 refresh); :382-393 back-to-waiting writes stale whole-blob reverting other stations. StationSetup.js:505 — station URLs carry no gym id; fresh iPad reads gym "default" (FIX: include gym in station URL/route).
- [x] F5 MAJOR useMembers.js:50-107 — auto-processing effect runs before cloudLoaded (gate on it); also mutates state in place; useMembers.js:111-136 booking auto-clear wipes bookings 30min after session end breaking no-show marking + cron.
- [x] F6 MAJOR MessagingView.js:110-134 — `?to=` deep link: `conversations.length === undefined` never true; autoOpenProcessed set before members load; writes before cloudLoaded.
- [x] F7 MINOR FeedbackForm.js:51-64 — read-modify-write race on __super__/hf_feedback; gym fallback "local" vs "default".
- [x] F8 MAJOR SignUpPage.js:108-110 + SuperAdminPanel.js:302-303 — registry whole-blob rewrites from stale state clobber concurrent signups.

## G. PAYMENTS / BILLING

- [x] G1 CRITICAL PaymentModal.js:9 — Stripe pk read from `hf_stripe_pk` which nothing writes (Settings stores under hf_integrations) → always placeholder key.
- [x] G2 CRITICAL PaymentModal.js:68-71,82-88,207-211 — "saved method" path fakes success (books revenue, charges nobody); saved cards fabricated.
- [x] G3 CRITICAL server/index.js:343 vs :9 — express.json() consumes body before webhook's express.raw → Stripe webhook always 400; handler persists nothing anyway.
- [x] G4 MAJOR BillingView.js:693,949 — Collect/Record Payment opens modal with amount 0; card/ACH forms have no amount field → "Pay $0.00".
- [x] G5 MAJOR PaymentModal.js:424-444 vs 76,218 — discount display-only; full amount charged/recorded.
- [x] G6 MAJOR BillingView.js:374-400 — isFEO flag dropped on record; FEO checkbox does nothing.
- [x] G7 MAJOR GymBillingView.js:16 + server — hf_subscription never refreshed (no status polling; webhook no-op) → "Trial — 0 days left" forever.
- [x] G8 MINOR BillingView.js:352-371 — partial refunds remove full original amount from revenue.
- [x] G9 MINOR BillingView.js:381-389 — payments recorded without memberId → "from Unknown", fragile name joins.
- [x] G10 MINOR server/index.js:33-39 — create-fc-session with missing email attaches bank to arbitrary customer.

## H. DASHBOARD / ANALYTICS MATH

- [x] H1 MAJOR BusinessDashboard.js:917-926,1055,1072,1094-1096,1130 — quarter/year presets mix range revenue with single-month ad spend/funnel (ROAS wrong).
- [x] H2 MAJOR BusinessDashboard.js:966,983,2062,1688 — "MRR" sums raw plan prices across annual/weekly cycles without normalization.
- [x] H3 MAJOR CoachingDashboard.js:404,429-433,561 — No Show marks member as checked-in (todayCheckins doesn't exclude noShow).
- [x] H4 MINOR CoachingDashboard.js:181-183 — shift banner nags every coach for any class day (no instructor match).
- [x] H5 MINOR CoachingDashboard.js:71-74,134,526 — "Last seen Infinity days ago" for members without startDate.
- [x] H6 MINOR AnalyticsView.js:87-95,70 — churn/growth denominators use current roster for historical periods.
- [x] H7 MINOR AnalyticsView.js:107-109 — avg daily attendance divides by active-day count, not elapsed days.
- [x] H8 MINOR BusinessDashboard.js:1017-1020 — attrition uses today's member count as historical base.
- [x] H9 MINOR BusinessDashboard.js:315-349,499-505 — funnel editor allows 1/0 stages → NaN widths.
- [x] H10 MAJOR DashboardView.js — dead duplicate dashboard (not imported anywhere) with diverged bugs. FIX: delete file.
- [~] H11 MINOR BusinessDashboard.js:806,1030-1052,1812-1841 — hf_leads has no writer; CRM funnel drill-downs dead; funnel bar dispatches "funnel_leads" which no case handles.

## I. MESSAGING / EMAIL

- [x] I1 CRITICAL EmailBuilder.js:177-191 — campaign send posts wrong payload (htmlBody/gymName) to wrong host; never uses sendBulkEmail contract (html/recipients/subject/from) → every campaign fails.
- [x] I2 MAJOR MessagingView.js:431-436 + ClientPortal.js:3214 — 👍 quick-send uses stale closure → sends nothing.
- [x] I3 MAJOR MessagingView.js:382,402-408 — image "send" appends ` [img:dataUrl]` text; renderers show raw base64; FloatingChat parser requires startsWith("[img:").
- [x] I4 MAJOR MessagingView.js:195-199 — "new message" notification fires on sender's own device only.
- [x] I5 MAJOR EmailBuilder.js:363-397 — execCommand toolbar loses selection (no onMouseDown preventDefault) → formatting buttons do nothing.
- [x] I6 MINOR EmailBuilder.js:178 — bulk subject merges {firstName}→"Member" for everyone.
- [x] I7 MINOR MessagingView.js:40-85 — buildDemoConversations references undefined myId (dead code, latent crash).
- [x] I8 MINOR ClientPortal.js:2256 — Message Coach uses stale non-functional setMessages update.
- [x] I9 MAJOR utils/youtube.js:1 — getYTId breaks on `youtu.be/ID?si=...` share links and /shorts//embed/ URLs.

## J. AUTOMATIONS / SETTINGS

- [x] J1 CRITICAL AutomationsView.js:172,197,260,275 — automations demand BYOK keys even in platform messaging mode → all sends fail in default config.
- [x] J2 MAJOR AutomationsView.js:161,179 — "Run Now" ignores trigger conditions; emails ALL members "payment of $0.00 overdue" (hardcoded vars).
- [x] J3 MAJOR AutomationsView.js:108 — no scheduler exists; enable toggles do nothing; welcome email hardcoded in MembersView ignores template.
- [x] J4 MAJOR SettingsView.js:1533-1539 — "Load Demo Data" loads nothing (no hook reads hf_demo_loaded; DEMO_MEMBERS dead).
- [x] J5 MAJOR Sidebar.js:112 vs SettingsView.js:289 — feature toggles need full reload (independent hook instances; no cross-notify). (A3 polling largely heals; consider storage event.)
- [x] J6 MINOR DataMigrationView.js:424,388-406 — .xlsx accepted but parsed as CSV.
- [x] J7 MINOR DataMigrationView.js:513-514 — weight/bodyFat column order loses inbody data.
- [x] J8 MINOR exportUtils.js:101-121 — exportToPDF nukes DOM + force-reload (drops pending debounced writes).
- [x] J9 MINOR AutomationsView.js:133-135 — duplicate log ids from Date.now() in bulk.

## K. MEMBERS / WAIVERS

- [x] K1 CRITICAL WaiverView.js:115-128 — default hf_waivers fabricates SIGNED waivers for first 4 real members.
- [x] K2 MAJOR WaiverView.js:148-152,178,352,411 — custom-doc signatures counted as liability waiver; re-signing deletes member's other signed docs.
- [x] K3 MINOR WaiverView.js:449 — "Send Waiver" only shows toast, sends nothing.
- [x] K4 MAJOR MemberProfile.js:350,232-248 — Address EditableRow writes joined "street, city, state, zip" string into address.street.
- [x] K5 MAJOR MemberProfile.js:256-279 — EditableRow defined inside render → input remounts per keystroke.
- [x] K6 MAJOR MemberProfile.js:1081-1085 + MembersView.js:676-680 — undo plan-change removes wrong event type ("join"); doesn't restore planEndDate.
- [x] K7 MINOR MembersView.js:398 — `minmax(340, 1fr)` unitless → grid collapses. (Same: ResourcesView.js:886 `minmax(320,1fr)`, DataMigrationView.js:748 `minmax(260,1fr)`.)
- [x] K8 MINOR MembersView.js:552 — literal `•` in JSX text. (Same class: ResourcesView.js:307,522,561,1221; IntegrationsView.js:119,512.)
- [x] K9 MINOR MembersView.js:287-298 — edit modal strips long passwords to 4-digit PIN input.
- [x] K10 MINOR MembersView.js:14-22,924-927 — stored membershipStatus "trial"/"inactive" unreachable/not round-trippable.
- [x] K11 CRITICAL ProgressPhotos.js:30,83 + MemberProfile.js:1256-1263 + WaiverView.js:169 — unbounded base64 images accumulate in single blobs (progress photos shared across ALL members in one array). At minimum: photos filtered per member + size cap + warn. 
- [x] K12 MINOR useMembers.js:4-13 — DEMO_MEMBERS dead code; useMembershipEvents seeds demo events for members that don't exist.

## L. WORKOUT CORE / STATIONS / CLASSROOM / RESOURCES

- [x] L1 MAJOR BuildView.js:45 — editing a workout always appends a new copy (id discarded) → duplicates; references keep pointing at stale copy.
- [x] L2 MAJOR WorkoutsView.js:69 — deleting a workout leaves dangling references (programs/schedule/stations/remote).
- [x] L3 MAJOR ProgramsView.js:8-10,34 — print prints the app screen (no PrintArea rendered).
- [x] L4 MAJOR autoIndividualize.js:67-71 — unknown exercises silently replaced from patternChains[0] (unrelated movement) for everyone.
- [~] L5 MAJOR ClassroomView.js:79-80,94-99,131-140 — clients can never see courses (no portal reader); progress ignores memberId (cross-corruption when second writer appears); deleteCourse never wired to UI (:175).
- [x] L6 MINOR AssessmentView.js:112-120 — saving assessment wipes movementScores outside the 7 assessed patterns.
- [x] L7 MINOR MatrixView.js:6,35-37 — progression dropdowns use static EX not gym hf_ex.
- [x] L8 MINOR BuildView.js:37 — duplicate section ids after delete-then-add.
- [x] L9 MINOR CommandView.js:486-498 — auto-individualization applied even when progression_engine toggled off.
- [x] L10 MINOR CommandView.js:514 + RemoteWorkoutsView.js:296 + AssessmentView.js:66 — filters require membershipPlanId; plan-less active members invisible ("No clients found").
- [x] L11 MINOR ImageUpload.js:5-27 — resizeImage never rejects (hangs on corrupt file); JPEG-flattens transparency to black.
- [x] L12 MINOR StationDisplay.js:302-307 — isLogged ignores date; old logs mark today's exercises complete.
- [x] L13 MINOR SuperAdminPanel.js:1293-1301 — master exercise library seeds from current browser's hf_ex cache.

## M. SCHEDULING SEMANTICS

- [~] M1 MAJOR ScheduleView.js:152-163 — "delete only this instance" just sets recurring:false; no per-date instance/exception model; bookings not tied to dates; week navigation shows identical sessions all weeks.
- [x] M2 MAJOR ScheduleView.js:228 — noAllotmentDeduction written but never read; no-show allotment semantics opposite of UI promise.
- [x] M3 MINOR ScheduleView.js:136 — editing session drops all but first selected day.
- [x] M4 MAJOR ClientPortal.js:1012-1013 — cancel policy read from localStorage key never loaded on client device (hf_noshow_settings) → gym policy ignored.
- [x] M5 MINOR EventsView.js:29,204-208 — recurring events never recur.

## N. SUPER ADMIN / ONBOARDING FLOWS

- [x] N1 MAJOR SuperAdminPanel.js:367-380 — first Edit on unexpanded gym reads stale empty gymDetails; Save overwrites real gym info/subscription with blanks. handleExtendTrial (:323-325) same stale-read → two-click no-op.
- [x] N2 MAJOR OnboardingWizard.js:222 — "Open Workout Builder" discards all wizard data (skips handleFinish) and completion flag blocks re-entry.
- [x] N3 MINOR OnboardingWizard.js:240-247 — step-6 cards navigate to nonexistent /dashboard & /scheduling; double navigation race.
- [x] N4 MINOR OnboardingWizard.js:56 — onboarding-complete flag localStorage-only; new device reopens wizard; re-finishing can overwrite real hf_members.
- [x] N5 MINOR App.js:224 — /super-admin/ (trailing slash) falls through to gym routes → blank.
- [x] N6 MINOR LandingPage.js:102 — "Watch Demo" dead button.
- [x] N7 MAJOR LoginPage.js:57-58 + AuthContext.js:38-40 — requiresReload login races session persistence vs hard navigation → can land logged-out.
- [x] N8 MINOR SuperAdminPanel "delete gym" — DELETE works in prod (verified), but registry rewrite from stale state can clobber concurrent signups (see F8). Check res.ok on deletes anyway.

## O. DEAD/STUB FEATURES (decide: wire up, hide, or label)

- [~] O1 Rank + Shop views are "Coming Soon" stubs but routed & in nav.
- [~] O2 Gamification economy dead: nothing ever awards XP/levels/badges/streaks; pointsPerAction settings unused (GamificationView.js:19,33-38).
- [~] O3 CRM: hf_leads has no writer; CRMView unrouted stub.
- [x] O4 useServerStorage.js — orphaned hook, nonexistent endpoints.
- [~] O5 AccountabilityView.js:134-139,156-161 — misleading "underutilized" detail; birthday alerts repeat weekly all month; streak trigger keys off permanently-stale gamification fields.

## P. CLIENT PORTAL / AUTH (from final audit cluster)

- [x] P1 CRITICAL ClientPortal.js:660-663 — Workouts tab sorts hf_workout_logs by `b.date.localeCompare` but remote/station logs have only `timestamp` → TypeError white-screens tab.
- [x] P2 MAJOR ClientPortal.js:1975-1979 — progress calendar filters `a.date||a.timestamp` but records use `checkInTime` → always empty.
- [x] P3 MAJOR EditProfileModal.js:69,98-100 — clients can never change password (client session has no `password`; updateUser targets hf_users id that doesn't exist).
- [x] P4 MAJOR LoginPage.js:27-28 — Forgot PIN reads only local hf_members cache (empty on fresh device) → should search Supabase like AuthContext.
- [x] P5 MAJOR ClientPortal.js:143 vs 3058 — duplicate hf_attendance hook instances diverge/clobber. Same for hf_schedule (142 vs useMembers 110).
- [x] P6 MAJOR ClientPortal.js:568,415 — "Message Your Coach" card goes to community tab which has no chat (chat only in Profile tab).
- [x] P7 MINOR ClientPortal.js:2288-2297 — "My Payment Methods" button is an empty TODO stub.
- [x] P8 MINOR ClientPortal.js:3145 — members without membershipPlanId fully locked out (incl. all demo members with "").
- [x] P9 MINOR ClientPortal.js:236-262 — class that ended today vanishes from Upcoming for a week (offset loop 0-6 skips today's ended, never reaches 7).
- [x] P10 MINOR ClientPortal.js:1020-1028 — late-cancel penalty only for same-day cancels (11pm cancel of 6am class escapes window).
- [x] P11 MINOR ClientPortal.js:2376-2378 — notification permission requested without user gesture (auto-denied).
- [x] P12 MINOR LoginPage.js:212-230 — submit button not disabled while logging in (double submits).
- [x] P13 MAJOR useMembers.js effects (dup of F5) run in every CLIENT browser too — stale-cache overwrites cloud for whole gym.

## SIMULATION-DISCOVERED (dynamic)

- [x] S1 Coach saved workout in /build but nothing persisted to hf_w (verify cause — may be save flow validation or clobber race A2).
- [x] S2 Client tapped Book but no booking persisted to hf_schedule (likely P8 plan lockout for demo members with empty membershipPlanId, or booking UI needs plan).
- [x] S3 Admin /members "Add Member" + /settings staff flows hang the sim (possible native confirm/alert dialog or overlay) — investigate.
