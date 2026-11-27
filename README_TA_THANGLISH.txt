BIGIL SUPER LEAGUE S3 – STARTER PROJECT

IMPORTANT:
This is a starter source project, NOT a published/live website yet.
It needs a Firebase project, account setup, database rules, and hosting.
Do not share Firebase passwords or private keys in chat.

1) Firebase setup (Android Chrome):
- Open https://console.firebase.google.com/
- Create a project: bigil-super-league-s3
- Add a Web App and copy the config values into firebase-config.js
- Authentication > Sign-in method > enable Email/Password
- Authentication > Users: create 1 admin account + 10 owner accounts.
- Realtime Database > Create database.
- Copy the database URL into firebase-config.js.
- In Realtime Database, import database.rules.json after replacing REPLACE_ADMIN_UID
  with the admin account UID.
- In Realtime Database Data, create:
  owners
    ADMIN_OWNER_UID: (not required; admin is identified by ADMIN_UID)
    OWNER_UID_1: { "teamId": "CSK" }
    OWNER_UID_2: { "teamId": "MI" }
    ... one UID per owner, assigned to their team.
  teams
    CSK: { "purse": 120, "squad": 0 }
    MI:  { "purse": 120, "squad": 0 }
    ... repeat for all 10 teams.
- Put the admin UID in ADMIN_UID in firebase-config.js.

2) Run locally:
This project uses ES modules. It must be served from a web server, not opened as file://.
A simple free static host can publish the files after setup.

3) CURRENT LIMITATIONS / DO NOT USE FOR A REAL AUCTION YET:
- This is an early starter, not security-audited.
- Admin can add players and open the next player.
- Owners can place bids; bid sync uses Firebase Realtime Database.
- Retention form currently records the deduction/name, but does not yet safely add retained players to squads or exclude them from a 250-player pool automatically.
- Sold player purse/squad update is an early client-side flow and needs a trusted server-side transaction / Cloud Function before a real-money or high-stakes league.
- Owner permissions and database rules must be reviewed and tested before inviting all 10 owners.
- No real player database is included yet; admin must add players.
- Do not enter passwords in the source files or send them to anyone.

Next development step: finish server-validated auction actions, retention-to-squad integration, player import, and test with dummy accounts before publishing.
