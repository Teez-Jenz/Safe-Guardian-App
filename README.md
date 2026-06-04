Project Concept: SafeAlert Guardian
Mission

Help people quickly alert trusted contacts and emergency responders when they feel unsafe.

User Scenario

Imagine a student is entering a taxi and feels uncomfortable.

They open SafeAlert Guardian and press:

🆘 Emergency SOS

Within seconds, the system:

Captures GPS location.
Records current time.
Sends alerts to trusted contacts.
Begins sharing live location updates.
Stores recent location history.
Displays emergency contacts.

If the phone later loses signal or is turned off, responders can still see:

Last known location
Last update time
Recent movement route
Competition Features
Feature 1: SOS Button

Large red button:

┌──────────────────┐
│ 🆘 │
│ SEND ALERT NOW │
└──────────────────┘

When clicked:

navigator.geolocation.getCurrentPosition(...)

Location is sent to the backend.

Feature 2: Trusted Contacts

Users can add:

Parent
Guardian
Friend
Teacher

Example:

Mom
+234xxxxxxxxxx

Dad
+234xxxxxxxxxx
Feature 3: Live Location Sharing

Every 30 seconds:

setInterval(() => {
// send location
}, 30000);

Store:

{
userId,
latitude,
longitude,
timestamp
}
Feature 4: Emergency Dashboard

Authorized users can see:

Name: John Doe

Status: SOS ACTIVE

Last Seen:
6:43 PM

Location:
Yaba, Lagos
Feature 5: Safety Check-In

User chooses:

I'm taking a taxi
Expected arrival:
45 minutes

System starts timer.

If timer expires and user doesn't check in:

⚠️ User missed check-in

Emergency contacts are notified.

Feature 6: Route History

Store last 20 locations.

Display on map.

Example:

Point A
↓
Point B
↓
Point C

This helps identify the person's recent path.

Advanced Features
Voice Activation

User says:

Help me

or

Emergency

and SOS is triggered.

Fake Call Generator

The app can simulate an incoming call to help someone leave an uncomfortable situation.

Risk Zone Alerts

If the user enters an area reported as dangerous:

⚠️ Warning

This area has multiple recent incidents.
