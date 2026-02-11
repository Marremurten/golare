/**
 * Swedish Guzman-persona message templates for all interactions.
 * Dynamic templates use functions; static messages use plain strings.
 *
 * IMPORTANT: All Swedish text MUST use proper åäö characters.
 * Never substitute with a/a/o.
 */

// ---------------------------------------------------------------------------
// Rules page content (extracted for RULES_PAGE function self-reference)
// ---------------------------------------------------------------------------

const _RULES_PAGE_ROLLER =
  "<b>🎭 Rollerna i Ligan</b>\n\n" +
  "Lyssna upp, det finns tre typer av folk i det här spelet:\n\n" +
  "<b>Äkta</b> -- Ligans lojala medlemmar. Genomför stötar för att " +
  "hålla verksamheten igång. Ni är familjen, bre.\n\n" +
  "<b>Golare</b> -- Infiltratörer som jobbar med Aina. " +
  "Vet vilka de andra Golare är. Saboterar stötar inifrån. " +
  "Råttor, helt enkelt. 🐀\n\n" +
  "<b>Guzmans Högra Hand</b> -- En av de Äkta med specialförmågan " +
  '"Spaning" (kan kolla en spelares riktiga roll en gång under spelet). ' +
  "Måste hålla sig dold -- om Golare listar ut vem det är, " +
  "kan dom stjäla vinsten. 🔍\n\n" +
  "<i>Ligan vs Aina. Familj vs Förrädare. Välj sida.</i>";

const _RULES_PAGE_SPELGANG =
  "<b>⚙️ Spelgång</b>\n\n" +
  "Varje runda kör vi igenom fem steg, bre:\n\n" +
  "<b>1. Capo-val (09:00)</b> -- En spelare blir Capo och " +
  "väljer sitt team för rundan.\n\n" +
  "<b>2. Röstning (12:00)</b> -- Gruppen röstar JA eller NEJ " +
  "på Capos teamval. Tre NEJ i rad = automatisk fail " +
  "(Kaos-mätaren). 💥\n\n" +
  "<b>3. Stöten (15:00)</b> -- Teamet genomför uppdraget. " +
  "Varje teammedlem väljer i hemlighet: Genomför eller Gola.\n\n" +
  "<b>4. Resultat (18:00)</b> -- Rösterna avslöjas. " +
  "Minst en Gola-röst = saboterat. Noll Gola = lyckat.\n\n" +
  "<b>5. Diskussion (21:00)</b> -- Snacka, anklaga, ljug. " +
  "Sen börjar nästa runda. 🔄\n\n" +
  "<i>Timing kan variera -- Guzman bestämmer tempot.</i>";

const _RULES_PAGE_VINST =
  "<b>🏆 Vinstvillkor</b>\n\n" +
  "Det finns två sätt att vinna, bre:\n\n" +
  "<b>Ligan vinner:</b> 3 lyckade stötar (inga Gola-röster). " +
  "Familjen håller ihop och verksamheten rullar. ✅\n\n" +
  "<b>Aina vinner:</b> 3 saboterade stötar (minst en Gola-röst " +
  "i varje). Råttorna äter oss inifrån. 🐀\n\n" +
  "<b>--- Sista Chansen ---</b>\n\n" +
  "Om Ligan vinner: Golare får <b>en chans</b> att peka ut " +
  "Guzmans Högra Hand. Rätt gissning = Aina stjäl vinsten! 😱\n\n" +
  "Om Aina vinner: De Äkta får <b>en chans</b> att peka ut " +
  "en Golare. Rätt gissning = Ligan stjäl tillbaka vinsten! 💪\n\n" +
  "<i>Inget är över förrän det är över. Spela smart till sista sekunden.</i>";

export const MESSAGES = {
  /** Welcome message when user /start's the bot directly (no deep link) */
  WELCOME_DIRECT:
    "Yo bre, välkommen till familjen! 🤝\n" +
    "Jag är Golare-boten -- jag håller koll på allt och alla.\n" +
    "Du är inne nu, shuno. När det är dags att spela får du ett meddelande här. 🔥",

  /** Welcome message when user /start's via deep link from a group */
  WELCOME_DEEP_LINK: (groupName?: string) =>
    `Shuno, jag ser att du kommer från gruppen${groupName ? ` ${groupName}` : ""}! 👀\n` +
    "Bra att du klickade, bre. Du är registrerad nu.\n" +
    "Sitt tight -- jag hör av mig när det är game time. 🎯",

  /** Message when user /start's but is already registered */
  WELCOME_ALREADY_REGISTERED:
    "Bre, du är redan inne. Lugn. 😎\n" +
    "Jag har koll på dig, du behöver inte göra någonting mer.",

  /** Group announcement when a player completes /start via deep link */
  REGISTRATION_CONFIRMED_GROUP: (name: string) =>
    `${name} är inne! 🔥 Välkomna till familjen, bre.`,

  /** Group message calling out an unregistered player with deep link */
  DM_CALLOUT: (name: string, link: string) =>
    `Yo ${name}, vad väntar du på? 👊\n` +
    `Klicka här bre: ${link}`,

  /** Follow-up group reminder for player who still hasn't /start'd */
  DM_REMINDER: (name: string, link: string) =>
    `${name}... shuno, alla väntar på dig. 😤\n` +
    `Tryck på länken nu bre, sluta para: ${link}`,

  /** Message when queue delay exceeds threshold */
  QUEUE_DELAY:
    "Lugn bre, jag håller på... 🔄\n" +
    "Ge mig en sekund, det är mycket som händer.",

  // -------------------------------------------------------------------------
  // Lobby messages (Phase 2)
  // -------------------------------------------------------------------------

  /** Guzman announces a new game lobby */
  LOBBY_CREATED: (adminName: string) =>
    `Yo, ${adminName} vill starta en stöt! 🔥\n` +
    "Vem är med? Tryck 'Jag är med!' bre.",

  /** Dynamic lobby status with player count and names */
  LOBBY_TEXT: (players: string[], maxPlayers: number) => {
    const count = players.length;
    const names = count > 0 ? players.join(", ") : "Inga än...";
    return (
      `${count}/${maxPlayers} spelare: ${names}\n\n` +
      "Tryck 'Jag är med!' för att hoppa in, bre."
    );
  },

  /** Lobby is full (max players reached) */
  LOBBY_FULL: "Fullt bre! Max 10 spelare. 🚫",

  /** Player hasn't /start'd the bot -- shown as toast */
  LOBBY_NOT_REGISTERED:
    "Du måste starta boten först! Skicka /start till mig privat. 👊",

  /** Player already in the game -- shown as toast */
  LOBBY_ALREADY_JOINED: "Du är redan med, bre. Lugn. 😎",

  /** Player tried to leave but isn't in the game -- shown as toast */
  LOBBY_NOT_IN_GAME: "Du är inte med i spelet, bre. 🤷",

  /** Not enough players to start -- shown as toast */
  LOBBY_MIN_PLAYERS: (min: number) =>
    `Det behövs minst ${min} spelare för att köra, bre. ⏳`,

  /** Non-admin tried to create a game */
  LOBBY_NOT_ADMIN: "Bara admins kan starta spel här, bre. 🚫",

  /** Group already has an active game */
  LOBBY_GAME_EXISTS:
    "Det finns redan ett spel igång i den här gruppen, bre! 🎮",

  /** No active game in the group */
  LOBBY_NO_GAME:
    "Det finns inget aktivt spel här, bre. Kör /nyttspel för att starta ett! 🎯",

  // -------------------------------------------------------------------------
  // Role reveal DMs (Phase 2, Plan 02)
  // -------------------------------------------------------------------------

  /** Role reveal DM for Äkta players */
  ROLE_REVEAL_AKTA:
    "Yo bre, lyssna noga...\n\n" +
    "Du är <b>ÄKTA</b>. Du tillhör <b>Ligan</b> -- vi är familjen. 🤝\n\n" +
    "Din uppgift: Genomför stötar framgångsrikt. Välj rätt folk till teamen, " +
    "och var jävligt noga med vem du litar på.\n\n" +
    "Vinst: <b>3 lyckade stötar</b> och Ligan vinner.\n\n" +
    "Men shuno... det finns Golare bland oss. Dom jobbar för Aina " +
    "och vill sabotera allt vi byggt. Lita inte på någon blint. 👀\n\n" +
    "Håll ögonen öppna. Familjen räknar med dig. 🔥",

  /** Role reveal DM for Golare players -- receives list of other Golare */
  ROLE_REVEAL_GOLARE: (otherGolare: string) => {
    const golareInfo = otherGolare
      ? `Dina bröder i skiten: ${otherGolare}. Ni vet om varandra -- använd det. 🤫`
      : "Du är ensam, bre. Ingen annan Golare. Allt hänger på dig. 💀";

    return (
      "Psst... kom hit, bre.\n\n" +
      "Du är <b>GOLARE</b>. Du jobbar för <b>Aina</b>. 🐀\n\n" +
      "Din uppgift: Sabotera Ligans stötar inifrån. Smyg dig in i teamen " +
      "och välj [Gola] när det gäller. Men var försiktig -- om dom fattar " +
      "att du är en råtta så är du rökt.\n\n" +
      `${golareInfo}\n\n` +
      "Vinst: <b>3 saboterade stötar</b> och Aina vinner.\n\n" +
      "Spela ditt spel smart. Ljug, manipulera, peka finger åt andra. " +
      "Gör vad du måste. Bara bli inte avslöjad. 🎭"
    );
  },

  /** Role reveal DM for Högra Hand (Guzmans Högra Hand) */
  ROLE_REVEAL_HOGRA_HAND:
    "Yo... kom närmare. Det här stannar mellan oss. 🤫\n\n" +
    "Du är <b>Guzmans Högra Hand</b>. Du tillhör <b>Ligan</b>, " +
    "men du har en specialposition som ingen annan vet om.\n\n" +
    "Din förmåga: <b>Spaning</b> -- en gång under hela spelet kan du " +
    "kolla en spelares riktiga roll. Använd det klokt, bre. " +
    "Det kan ändra allt. 🔍\n\n" +
    "Ditt mål: Hjälp Ligan vinna stötar och guida gruppen rätt -- " +
    "men gör det subtilt. Om Golare listar ut att du är Högra Hand " +
    "kan dom stjäla vinsten i slutet.\n\n" +
    "Du har Guzmans förtroende. Svek det inte. 👊\n\n" +
    "Vinst: <b>3 lyckade stötar</b> och Ligan vinner. " +
    "Men håll dig gömd -- du är Golares största mål. 🎯",

  // -------------------------------------------------------------------------
  // Game start & cancellation (Phase 2, Plan 02)
  // -------------------------------------------------------------------------

  /** Dramatic Guzman monologue posted to group when game starts */
  GAME_START_MONOLOGUE:
    "<b>Ligan... lyssna upp.</b> 🎬\n\n" +
    "Nånting luktar fisk i byn, bre. Jag har hört rykten... " +
    "det finns <b>Golare</b> bland oss. Råttor som jobbar för Aina. 🐀\n\n" +
    "Men vi kör ändå. Vi har stötar att genomföra. " +
    "Varje runda väljer en <b>Capo</b> sitt team -- " +
    "och gruppen röstar om dom litar på valet.\n\n" +
    "Teamet går sen in och gör jobbet. " +
    "Eller... saboterar det inifrån. 👀\n\n" +
    "<b>3 lyckade stötar</b> och Ligan vinner. " +
    "<b>3 saboterade</b> och Aina tar hem det.\n\n" +
    "Kolla era DMs -- ni har fått era roller. " +
    "Lita inte på någon. <b>Spelet börjar nu.</b> 🔥",

  /** Group announcement when admin cancels the game */
  GAME_CANCELLED: (adminName: string) =>
    `${adminName} drog i nödbromsen. Spelet är avbrutet, bre. 🚫`,

  /** answerCallbackQuery confirmation for admin on cancel */
  GAME_CANCEL_CONFIRM: "Spelet avbrutet. 🚫",

  // -------------------------------------------------------------------------
  // Rules pages (Phase 2, Plan 03)
  // -------------------------------------------------------------------------

  /** Rules page: Roller -- the three roles in the game */
  RULES_PAGE_ROLLER: _RULES_PAGE_ROLLER,

  /** Rules page: Spelgång -- game flow and daily cycle */
  RULES_PAGE_SPELGANG: _RULES_PAGE_SPELGANG,

  /** Rules page: Vinst -- win conditions */
  RULES_PAGE_VINST: _RULES_PAGE_VINST,

  /** Function to get the right rules page content */
  RULES_PAGE: (page: "roller" | "spelgang" | "vinst"): string => {
    switch (page) {
      case "roller":
        return _RULES_PAGE_ROLLER;
      case "spelgang":
        return _RULES_PAGE_SPELGANG;
      case "vinst":
        return _RULES_PAGE_VINST;
    }
  },

  // -------------------------------------------------------------------------
  // Status display (Phase 2, Plan 03)
  // -------------------------------------------------------------------------

  /** Group/general status display */
  STATUS_TEXT: (data: {
    liganScore: number;
    ainaScore: number;
    round: number;
    totalRounds: number;
    state: string;
    players: Array<{ name: string; isCapo?: boolean }>;
    capo?: string;
  }): string => {
    const playerList = data.players
      .map((p) => (p.isCapo ? `👑 ${p.name}` : `  ${p.name}`))
      .join("\n");

    return (
      "<b>📊 Spelstatus</b>\n\n" +
      `<b>Ställning:</b> Ligan ${data.liganScore} - ${data.ainaScore} Aina\n` +
      `<b>Runda:</b> ${data.round}/${data.totalRounds}\n` +
      `<b>Fas:</b> ${data.state}\n\n` +
      `<b>Spelare (${data.players.length}):</b>\n` +
      playerList
    );
  },

  /** No active game fallback for /status */
  STATUS_NO_GAME: "Inget aktivt spel just nu, bre. 🤷",

  /** No active game in group for /status */
  STATUS_NO_GAME_GROUP:
    "Inget aktivt spel i den här gruppen just nu, bre. 🤷",

  /** No active game in DM for /status */
  STATUS_NO_GAME_DM: "Du är inte med i något aktivt spel just nu, bre. 🤷",

  /** Extra DM info showing player's secret role and abilities */
  STATUS_DM_EXTRA: (role: string, abilities: string): string =>
    `\n\n<b>🔒 Din roll:</b> ${role}\n<b>Förmågor:</b> ${abilities}`,

  // -------------------------------------------------------------------------
  // Game loop messages (Phase 3)
  // -------------------------------------------------------------------------

  /** Morning mission post -- kicks off the round */
  MISSION_POST: (roundNumber: number): string =>
    `<b>Ligan! Runda ${roundNumber}.</b> 🎯\n\n` +
    "Det är dags för en ny stöt, bre. Vi har ett jobb att göra " +
    "och jag behöver folk jag kan lita på.\n\n" +
    "Dagens <b>Capo</b> väljer sitt team. Sen röstar ni andra " +
    "om ni litar på valet. Gör rätt val -- det är era pengar " +
    "som står på spel. 💰",

  /** DM to Capo: pick your team */
  NOMINATION_PROMPT: (capoName: string, teamSize: number): string =>
    `Yo <b>${capoName}</b>, du är <b>Capo</b> den här rundan. 👑\n\n` +
    `Välj <b>${teamSize}</b> spelare till ditt team. ` +
    "Tryck på namnen nedan för att toggla, sen bekräfta.\n\n" +
    "Välj klokt, bre. Alla kollar på dig.",

  /** Group reminder 1h before nomination deadline */
  NOMINATION_REMINDER: (capoName: string): string =>
    `Yo ${capoName}, du har <b>en timme</b> kvar att välja ditt team, bre. ` +
    "Stressa inte -- men stressa lite. ⏰",

  /** DM reminder to Capo 1h before nomination deadline */
  NOMINATION_REMINDER_DM: (capoName: string): string =>
    `${capoName}, shuno -- du har fortfarande inte valt ditt team. ` +
    "En timme kvar. Gör ditt val nu, bre. ⏰",

  /** Group message when Capo didn't nominate in time */
  NOMINATION_TIMEOUT: (oldCapo: string, newCapo: string): string =>
    `${oldCapo} somnade vid ratten. 😴 Ingen nomination, ingen respekt.\n\n` +
    `Det räknas som en missad röstning. <b>${newCapo}</b> tar över som Capo nu. ` +
    "Hoppas du kan bättre, bre.",

  /** Group message showing proposed team */
  TEAM_PROPOSED: (capoName: string, teamNames: string[]): string =>
    `<b>${capoName}</b> har valt sitt team: 🎯\n\n` +
    teamNames.map((n) => `  - ${n}`).join("\n") +
    "\n\nLitar ni på det här valet? Dags att rösta.",

  /** Group message prompting everyone to vote */
  VOTE_PROMPT: (teamNames: string[]): string =>
    "<b>Röstning!</b> 🗳️\n\n" +
    `Team: ${teamNames.join(", ")}\n\n` +
    "Rösta <b>JA</b> om ni litar på teamet, " +
    "eller <b>NEJ</b> om ni inte gör det.\n\n" +
    "Alla röster avslöjas efteråt -- så tänk efter, bre.",

  /** Live tally (edited message) -- shows WHO voted but not HOW */
  VOTE_TALLY: (votedNames: string[], total: number): string => {
    const voterList = votedNames.length > 0
      ? votedNames.map((n) => `  [x] ${n}`).join("\n")
      : "  Inga röster ännu...";
    return (
      `<b>Röstat:</b> ${votedNames.length}/${total} 🗳️\n\n` +
      voterList
    );
  },

  /** Full vote reveal after deadline */
  VOTE_REVEAL: (votes: Array<{ name: string; vote: string }>): string => {
    const lines = votes.map(
      (v) => `  ${v.vote === "ja" ? "👍" : "👎"} ${v.name}: <b>${v.vote.toUpperCase()}</b>`,
    );
    return "<b>Röstresultat:</b>\n\n" + lines.join("\n");
  },

  /** Vote passed -- team approved */
  VOTE_APPROVED: (teamNames: string[]): string =>
    "<b>Godkänt!</b> ✅\n\n" +
    `Teamet ${teamNames.join(", ")} går in på stöten.\n\n` +
    "Nu gäller det, bre. Kolla era DMs -- det är dags att agera. 🎬",

  /** Vote rejected -- rotate Capo */
  VOTE_REJECTED: (nejCount: number, newCapo: string, failedVoteNum: number): string =>
    `<b>Nekat!</b> ❌ ${nejCount} röstade NEJ.\n\n` +
    `Det var röstning nummer ${failedVoteNum} som failade i den här rundan.\n` +
    `<b>${newCapo}</b> blir nästa Capo. Nytt försök, bre.`,

  /** Kaos-mataren escalation: first failed vote */
  KAOS_WARNING_1:
    "En röstning failade... det börjar lukta para i gruppen, bre. 😒\n" +
    "Ni behöver komma överens snart.",

  /** Kaos-mataren escalation: second failed vote */
  KAOS_WARNING_2:
    "Två röstningar failade i rad nu. <b>En till och det blir KAOS.</b> 💥\n" +
    "Jag börjar tappa tålamodet, shuno. Fixa det HÄR.",

  /** Kaos-mataren triggered: three failed votes = auto-fail */
  KAOS_TRIGGERED:
    "<b>KAOS!</b> 💥💥💥\n\n" +
    "Tre röstningar i rad och ni kunde inte enas om ETT team?! " +
    "Aina tar den här poängen gratis, bre.\n\n" +
    "Uppdraget misslyckas automatiskt. " +
    "Ni borde skämmas. Golare sitter och skrattar åt er. 🐀",

  /** DM to team members: choose Säkra or Gola */
  EXECUTION_PROMPT: (roundNumber: number): string =>
    `<b>Runda ${roundNumber} -- Stöten</b> 🎯\n\n` +
    "Du är med på teamet. Nu gäller det.\n\n" +
    "Välj:\n" +
    "  <b>Säkra</b> -- Genomför uppdraget lojalt\n" +
    "  <b>Gola</b> -- Sabotera uppdraget\n\n" +
    "Ingen ser vad du väljer. Bara resultatet avslöjas. 🤫",

  /** DM reminder to team member who hasn't acted */
  EXECUTION_REMINDER: (playerName: string): string =>
    `${playerName}, bre -- du har fortfarande inte gjort ditt val på stöten. ` +
    "En timme kvar. Välj Säkra eller Gola NU. ⏰",

  /** Group reminder about a team member who hasn't acted */
  EXECUTION_REMINDER_GROUP: (playerName: string): string =>
    `Väntar fortfarande på att <b>${playerName}</b> ska agera på stöten... ⏳`,

  /** DM notification when execution defaults to Säkra */
  EXECUTION_DEFAULT:
    "Du valde inte i tid. Uppdraget genomfördes lojalt åt dig (Säkra). ✅\n" +
    "Nästa gång -- gör ditt eget val, bre.",

  /** Mission success -- no Golare sabotaged */
  MISSION_SUCCESS:
    "<b>Stöten lyckades!</b> ✅\n\n" +
    "Alla var lojala -- eller så var Golare för fega att agera. " +
    "Ligan tar poängen! 💰",

  /** Mission failed -- at least one Gola */
  MISSION_FAIL: (golaCount: number): string =>
    "<b>Stöten misslyckades!</b> ❌\n\n" +
    `${golaCount} ${golaCount === 1 ? "person golade" : "personer golade"}. ` +
    "Det finns råttor bland oss, bre. 🐀\n" +
    "Aina tar poängen.",

  /** Score update after each round */
  SCORE_UPDATE: (liganScore: number, ainaScore: number, roundNumber: number): string =>
    `<b>Ställning efter runda ${roundNumber}:</b>\n\n` +
    `  Ligan: ${liganScore} 💰\n` +
    `  Aina: ${ainaScore} 🔵\n\n` +
    `Först till 3 vinner. ${5 - roundNumber > 0 ? `${5 - roundNumber} rundor kvar.` : "Sista rundan spelad."}`,

  /** Transition between rounds */
  ROUND_END: (roundNumber: number): string =>
    `Runda ${roundNumber} är över. 🔄\n\n` +
    "Vila upp er, snacka skit, peka finger. " +
    "Nästa runda väntar imorgon kl 09:00, bre.",

  /** Ligan wins the game (3 successful missions) */
  GAME_WON_LIGAN: (liganScore: number, ainaScore: number): string =>
    `<b>LIGAN VINNER!</b> 🏆💰\n\n` +
    `Slutställning: Ligan ${liganScore} - ${ainaScore} Aina\n\n` +
    "Familjen höll ihop! Tre lyckade stötar och verksamheten rullar vidare.\n\n" +
    "Men vänta... det kanske inte är över ännu. 👀",

  /** Aina wins the game (3 failed missions) */
  GAME_WON_AINA: (liganScore: number, ainaScore: number): string =>
    `<b>AINA VINNER!</b> 🔵🐀\n\n` +
    `Slutställning: Ligan ${liganScore} - ${ainaScore} Aina\n\n` +
    "Golarna gjorde sitt jobb. Tre saboterade stötar -- Ligan är körd.\n\n" +
    "Men vänta... det kanske inte är över ännu. 👀",

  /** Sista Chansen intro -- posted to group */
  SISTA_CHANSEN_INTRO: (guessingSide: string): string => {
    const sideText = guessingSide === "golare"
      ? "<b>Golare</b> -- ni har EN chans att peka ut <b>Guzmans Högra Hand</b>. " +
        "Gissar ni rätt stjäl ni vinsten från Ligan!"
      : "<b>Äkta</b> -- ni har EN chans att peka ut <b>en Golare</b>. " +
        "Gissar ni rätt tar ni tillbaka vinsten!";

    return (
      "<b>SISTA CHANSEN!</b> 🎲\n\n" +
      `${sideText}\n\n` +
      "Kolla era DMs -- ni har 2 timmar. Första gissningen gäller. " +
      "Välj klokt, bre."
    );
  },

  /** DM to guessing team members */
  SISTA_CHANSEN_DM: (targetDescription: string, playerNames: string[]): string =>
    `<b>Sista Chansen!</b> 🎲\n\n` +
    `Ni ska peka ut ${targetDescription}.\n\n` +
    "Diskutera med ditt lag och välj en spelare nedan.\n" +
    "<b>OBS:</b> Första gissningen som skickas gäller -- " +
    "så snacka ihop er först!\n\n" +
    "Kandidater:\n" +
    playerNames.map((n) => `  - ${n}`).join("\n"),

  /** Group announcement when someone makes the Sista Chansen guess */
  SISTA_CHANSEN_GUESS_MADE: (guesserName: string, targetName: string): string =>
    `<b>${guesserName}</b> har gjort sitt val: <b>${targetName}</b>. 🎯\n\n` +
    "Rätt eller fel? Vi får se...",

  /** Sista Chansen guess was correct -- winner changes! */
  SISTA_CHANSEN_CORRECT: (winningSide: string): string =>
    `<b>RÄTT GISSNING!</b> 🎉🎉🎉\n\n` +
    `Gissningen stämde! <b>${winningSide}</b> stjäl vinsten!\n\n` +
    "Vilken plot twist, bre. Ingen såg det komma. 🔥",

  /** Sista Chansen guess was wrong -- original winner stays */
  SISTA_CHANSEN_WRONG: (winningSide: string): string =>
    "<b>FEL GISSNING!</b> ❌\n\n" +
    `Tyvärr, det var fel. <b>${winningSide}</b> vinner ändå!\n\n` +
    "Bättre lycka nästa gång, bre. 💀",

  /** Sista Chansen timed out -- no guess made */
  SISTA_CHANSEN_TIMEOUT: (winningSide: string): string =>
    "<b>Tiden är ute!</b> ⏰\n\n" +
    "Ingen gissning gjordes. Chansen är borta.\n" +
    `<b>${winningSide}</b> vinner som planerat.\n\n` +
    "Ni hade er chans, bre. Ni blåste den. 💨",

  /** Final role reveal at the end of the game */
  FINAL_REVEAL: (roles: Array<{ name: string; role: string }>): string => {
    const lines = roles.map((r) => {
      const emoji = r.role === "golare" ? "🐀" : r.role === "hogra_hand" ? "🔍" : "👤";
      const roleName = r.role === "golare"
        ? "Golare"
        : r.role === "hogra_hand"
          ? "Guzmans Högra Hand"
          : "Äkta";
      return `  ${emoji} <b>${r.name}</b> -- ${roleName}`;
    });

    return (
      "<b>🎭 ROLLERNA AVSLÖJAS</b>\n\n" +
      "Nu kan ni se vilka som var vilka, bre:\n\n" +
      lines.join("\n") +
      "\n\nSpelet är slut. GG, familjen. 🤝"
    );
  },

  /** Group reminder for a player who hasn't voted */
  VOTE_REMINDER: (voterName: string): string =>
    `Yo <b>${voterName}</b>, du har inte röstat ännu! En timme kvar, bre. ⏰`,

  /** DM reminder for a player who hasn't voted */
  VOTE_REMINDER_DM: (voterName: string): string =>
    `${voterName} -- du har fortfarande inte röstat i gruppen. ` +
    "En timme kvar. Rösta JA eller NEJ nu, bre. ⏰",

  /** Suspense message 1 (before result reveal) */
  SUSPENSE_1:
    "Resultaten är inne... 🤔\n\n" +
    "Ge mig en sekund, bre.",

  /** Suspense message 2 (before result reveal) */
  SUSPENSE_2: "Okej... 👀",

  // -------------------------------------------------------------------------
  // Fallback variants for AI-replaced messages (Phase 4)
  // -------------------------------------------------------------------------

  /** Lazy Guzman prefix -- used when AI is unavailable to add character */
  FALLBACK_PREFIX: [
    "Orka snacka idag bre... ",
    "Guzman har huvudvärk, shuno... ",
    "Kort och gott idag mannen... ",
  ] as const,

  /** 3 variants for mission post (used as AI fallback for variety) */
  MISSION_POST_VARIANTS: [
    (roundNumber: number) =>
      `<b>Runda ${roundNumber} -- ny stöt!</b> 🎯\n\n` +
      "Ligan, det är dags igen. Vi har ett jobb att fixa " +
      "och jag behöver folk som håller käften och gör sitt.\n\n" +
      "Capo väljer teamet. Resten av er -- rösta klokt. 💰",
    (roundNumber: number) =>
      `<b>Stöt nummer ${roundNumber}, bre.</b> 🔥\n\n` +
      "Vakna upp, familjen. Nytt uppdrag, nya risker. " +
      "Nån jävla råtta kanske sitter och ler just nu.\n\n" +
      "Capo -- välj ditt team. Resten -- håll ögonen öppna. 👀",
    (roundNumber: number) =>
      `<b>Ligan! Runda ${roundNumber}.</b> 🎯\n\n` +
      "Det är dags för en ny stöt, bre. Vi har ett jobb att göra " +
      "och jag behöver folk jag kan lita på.\n\n" +
      "Dagens <b>Capo</b> väljer sitt team. Sen röstar ni andra " +
      "om ni litar på valet. Gör rätt val -- det är era pengar " +
      "som står på spel. 💰",
  ] as const,

  /** 3 variants for mission success (used as AI fallback) */
  MISSION_SUCCESS_VARIANTS: [
    "<b>Stöten lyckades!</b> ✅\n\n" +
      "Alla var lojala -- eller så var Golare för fega att agera. " +
      "Ligan tar poängen! 💰",
    "<b>Clean!</b> ✅\n\n" +
      "Ingen golade. Familjen håller ihop, bre. Poängen är vår. 💰",
    "<b>Lyckad stöt!</b> ✅\n\n" +
      "Bra jobbat. Inga råttor den här gången... eller? 🤔",
  ] as const,

  /** 3 variants for mission fail (used as AI fallback) */
  MISSION_FAIL_VARIANTS: [
    (golaCount: number) =>
      `<b>Stöten misslyckades!</b> ❌\n\n` +
      `${golaCount} ${golaCount === 1 ? "person golade" : "personer golade"}. ` +
      "Det finns råttor bland oss, bre. 🐀\nAina tar poängen.",
    (golaCount: number) =>
      `<b>Saboterat!</b> ❌\n\n` +
      `${golaCount} ${golaCount === 1 ? "person" : "personer"} sålde oss. Aina tar poängen. 🐀`,
    (golaCount: number) =>
      `<b>Vi åkte dit!</b> ❌\n\n` +
      `${golaCount} stycken golade. Familjen blöder, bre. 💀`,
  ] as const,
  // -------------------------------------------------------------------------
  // Engagement messages (Phase 5)
  // -------------------------------------------------------------------------

  /** Prompt user to choose whisper target */
  WHISPER_TARGET_PROMPT: "Vem vill du viska till, bre? Välj nedan. 👇",

  /** Prompt user to type their whisper message */
  WHISPER_MESSAGE_PROMPT: "Skriv ditt meddelande. Guzman fixar resten. 🤫",

  /** Confirmation after whisper is sent */
  WHISPER_SENT_CONFIRM: "Meddelandet har levererats. Ingen vet att det var du, bre. 🤫",

  /** Whisper expired (TTL) */
  WHISPER_EXPIRED: "Tiden gick ut, bre. Kör /viska igen om du vill. ⏰",

  /** Template fallback for whisper relay when AI is unavailable */
  WHISPER_RELAY_TEMPLATE: (whisperText: string) =>
    "<b>Guzman har fått ett anonymt meddelande...</b> 📩\n\n" +
    `<i>"${whisperText}"</i>\n\n` +
    "Nån i familjen har nåt att säga. Frågan är -- vem? 🤔",

  /** Template fallback for targeted whisper relay */
  WHISPER_RELAY_TARGETED_TEMPLATE: (targetName: string, whisperText: string) =>
    `<b>Guzman till ${targetName}:</b> 📩\n\n` +
    `Nån bad mig skicka det här till dig:\n<i>"${whisperText}"</i>\n\n` +
    "Vem det var? Det stannar hos mig, bre. 🤫",

  /** Player is on the team -- can't use engagement actions */
  ENGAGEMENT_ON_TEAM: "Du är med i teamet den här rundan, bre. Fokusera på stöten istället. 🎯",

  /** No active game for engagement actions */
  ENGAGEMENT_NO_GAME: "Du är inte med i något aktivt spel just nu, bre. 🤷",

  /** Game not in a valid phase for engagement actions */
  ENGAGEMENT_WRONG_PHASE: "Det finns inget aktivt uppdrag just nu, bre. Vänta tills nästa runda. ⏳",

  /** Surveillance: prompt to choose target */
  SURVEILLANCE_TARGET_PROMPT: "Vem vill du spana på, bre? Välj en teammedlem. 👇",

  /** Surveillance: already used this round */
  SURVEILLANCE_ALREADY_USED: "Du har redan spanat den här rundan, bre. Vänta till nästa. 🔒",

  /** Surveillance: target was notified */
  SURVEILLANCE_TARGET_NOTIFIED: "Någon har riktat blicken mot dig... 👀",

  /** Surveillance: confirmation sent to surveiller */
  SURVEILLANCE_SENT_CONFIRM: "Guzman har kollat runt åt dig. Kolla nedan. 🔍",

  /** Template fallback for surveillance clue when AI is unavailable */
  SURVEILLANCE_CLUE_TEMPLATE: (targetName: string) =>
    `Jag kollade på <b>${targetName}</b> åt dig, bre...\n\n` +
    "Svårt att säga. Antingen spelar den personen sitt spel bra, " +
    "eller så har den inget att dölja. 🤔",

  // -------------------------------------------------------------------------
  // Spaning messages (Phase 5, Plan 02)
  // -------------------------------------------------------------------------

  /** Spaning: prompt to choose who to investigate */
  SPANING_TARGET_PROMPT: "Vem vill du undersöka, bre? Du har bara EN chans i hela spelet. Välj klokt. 🔍",

  /** Spaning: already used */
  SPANING_ALREADY_USED: "Du har redan använt din Spaning i det här spelet, bre. En gång är en gång. 🔒",

  /** Spaning: only Akta and Hogra Hand can use it */
  SPANING_WRONG_ROLE: "Den här förmågan är inte för dig, bre. 🚫",

  /** Spaning: group notification (no details about who or target) */
  SPANING_GROUP_NOTIFICATION: "Någon har bett mig kolla runt... intressant. Mycket intressant. 🔍",

  /** Spaning: template fallback for Akta (cryptic) */
  SPANING_AKTA_TEMPLATE: (targetName: string, isTruthful: boolean, targetRole: string) => {
    const roleName = targetRole === "golare" ? "en råtta" : targetRole === "hogra_hand" ? "någon speciell" : "lojal";
    if (isTruthful) {
      return `Jag kollade på <b>${targetName}</b> åt dig, bre...\n\n` +
        `Min känsla säger att den personen är... ${roleName}. ` +
        "Men lita inte blint på mig -- jag har haft fel förr. 🤔";
    }
    // Lie: give wrong role hint
    const lieRole = targetRole === "golare" ? "lojal" : "en råtta";
    return `Jag kollade på <b>${targetName}</b> åt dig, bre...\n\n` +
      `Min känsla säger att den personen är... ${lieRole}. ` +
      "Men lita inte blint på mig -- jag har haft fel förr. 🤔";
  },

  /** Spaning: template fallback for Hogra Hand (direct, truthful) */
  SPANING_HOGRA_HAND_TEMPLATE: (targetName: string, targetRole: string) => {
    const roleName = targetRole === "golare" ? "GOLARE 🐀" : targetRole === "hogra_hand" ? "Guzmans Högra Hand 🔍" : "ÄKTA ✅";
    return `Lyssna noga, bre. <b>${targetName}</b> är <b>${roleName}</b>. Punkt. 🎯`;
  },

  // -------------------------------------------------------------------------
  // Role reveal and double scoring messages (Phase 5, Plan 02)
  // -------------------------------------------------------------------------

  /** Role reveal: intro message before individual reveals */
  ROLE_REVEAL_INTRO: "<b>ROLLERNA AVSLÖJAS</b> 🎭\n\nEn i taget, bre... 👀",

  /** Role reveal: template fallback for individual reveal */
  ROLE_REVEAL_INDIVIDUAL: (playerName: string, role: string) => {
    const emoji = role === "golare" ? "🐀" : role === "hogra_hand" ? "🔍" : "👤";
    const roleName = role === "golare" ? "GOLARE" : role === "hogra_hand" ? "Guzmans Högra Hand" : "Äkta";
    return `${emoji} <b>${playerName}</b> -- ${roleName}`;
  },

  /** Role reveal: finale message after all reveals */
  ROLE_REVEAL_FINALE: "Spelet är slut. Nu vet ni allt, bre. GG, familjen. 🤝",

  /** Score update with double point info (rounds 4-5) */
  SCORE_UPDATE_DOUBLE: (liganScore: number, ainaScore: number, roundNumber: number, pointValue: number) =>
    `<b>Ställning efter runda ${roundNumber}:</b>\n\n` +
    `  Ligan: ${liganScore} 💰\n` +
    `  Aina: ${ainaScore} 🔵\n\n` +
    `${pointValue > 1 ? `<i>Dubbelpoäng! Runda ${roundNumber} var värd ${pointValue} poäng.</i>\n\n` : ""}` +
    `Först till 3 vinner. ${5 - roundNumber > 0 ? `${5 - roundNumber} rundor kvar.` : "Sista rundan spelad."}`,
} as const;

/**
 * Pick a random variant from a readonly array.
 * Uses Math.random for non-security-critical template selection.
 */
export function getRandomVariant<T>(variants: readonly T[]): T {
  return variants[Math.floor(Math.random() * variants.length)];
}
