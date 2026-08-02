/* ---------------------------------------------------------------------------
   Mílù configuration.

   `firebaseDbUrl` powers the family leaderboard. Everything else in the app
   works without it — leave it empty and the leaderboard simply hides itself.
   Setting one up is the last section of SETUP.md.

   Ross's project: milu-chinese-app (asia-southeast1).
   Its rules only expose /boards/<code>, never the whole database.
   --------------------------------------------------------------------------- */
window.MILU_CONFIG = {
  firebaseDbUrl: 'https://milu-chinese-app-default-rtdb.asia-southeast1.firebasedatabase.app',
};
