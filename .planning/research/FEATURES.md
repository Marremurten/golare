# Feature Research

**Domain:** Telegram Bot Social Deduction Game (Async, Multi-Day)
**Researched:** 2026-02-10
**Confidence:** HIGH (core mechanics well-understood across the genre; async-specific patterns MEDIUM confidence due to fewer direct comparables)

## Competitor Landscape

Before mapping features, here is the ecosystem Golare enters:

| Game/Bot | Platform | Format | Players | Key Differentiator |
|----------|----------|--------|---------|-------------------|
| @WerewolfBot (tgwerewolf.com) | Telegram | Synchronous, 5-15 min rounds | 5-35 | 60+ roles, achievements, 5.9M+ players, open source |
| Mafia Game Master Bot | Telegram | Synchronous, ~20 min | 3-8 | Simplified Mafia, detective/mafia/civilian |
| Deloo's Avalon Bot | Discord | Synchronous, ~30 min | 5-10 | Faithful Avalon implementation, Lady of the Lake |
| Secret Hitler (secrethitler.io) | Web / Discord bot | Synchronous, ~30 min | 5-10 | Policy deck mechanic, Hitler doesn't know fascists |
| Town of Salem 2 | Standalone app | Synchronous, ~15 min | 15 | 50+ roles, investigation results system, wills |
| AI Wolves (Ideatrix) | Mobile app | Synchronous, ~10 min | 6-12 | AI-powered opponents with distinct personalities |
| Blood on the Clocktower | Physical / apps | Synchronous, 30-90 min | 5-20 | Storyteller role, ghost mechanic, information economy |
| Untrusted | Web | Synchronous, ~20 min | Up to 16 | Hacking theme, 27 classes, 100+ skills, log-based deduction |

**Critical observation:** Every existing competitor is synchronous -- all players online at the same time, games last minutes. Golare's 5-day async format has zero direct Telegram competitors. This is both the biggest opportunity and the biggest design risk.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are features that every social deduction game bot implements. Missing any of these would make Golare feel broken, not "minimalist."

| # | Feature | Why Expected | Complexity | Golare v1 Status | Notes |
|---|---------|--------------|------------|------------------|-------|
| T1 | **Secret role assignment via DM** | Core genre mechanic. Every bot does this. Players must learn their role privately. | Low | Planned | Golare: Akta/Golare/Hogra Hand via DM |
| T2 | **Team-aware information** | Informed minority (evil knows each other) is foundational to social deduction tension | Low | Planned | Golare know each other. Standard Avalon pattern. |
| T3 | **Team nomination + group voting** | The Resistance/Avalon core loop. The social deduction happens during nomination debate. | Medium | Planned | Capo rotation + JA/NEJ inline buttons |
| T4 | **Secret mission execution** | Team members must secretly choose success/fail. Without secrecy, no deduction needed. | Medium | Planned | [Sakra] / [Gola] via private buttons |
| T5 | **Win condition tracking + announcement** | Players need to know score and when the game ends. Every bot shows this. | Low | Planned | Best of 5, /status command |
| T6 | **Role reveal at game end** | The payoff moment. "I KNEW IT!" -- players need the reveal. WerewolfBot, Avalon all do this. | Low | Not explicitly listed | Must add: full role reveal when game ends |
| T7 | **Game state persistence** | Telegram bot may restart. Losing game state mid-game is unacceptable. WerewolfBot runs on persistent infra. | Medium | Planned | Supabase persistence |
| T8 | **Rules/help command** | New players join mid-group. Need on-demand rules. WerewolfBot has /rules and !wiki. | Low | Planned | /regler command |
| T9 | **Player list / alive status** | Players need to see who is in the game and current state. WerewolfBot: !stats shows alive players. | Low | Partially planned | /status shows score. Should also show player list + roles remaining. |
| T10 | **Inline button interactions** | No one types commands during gameplay in 2026. WerewolfBot uses PM voting lists. Avalon uses buttons. | Medium | Planned | JA/NEJ, [Sakra]/[Gola] via inline keyboards |
| T11 | **Failed vote escalation** | Avalon: 5 rejected teams = auto-fail. Secret Hitler: 3 failed elections = top policy enacted. Prevents infinite stalling. | Low | Planned | Kaos-mataren: 3 NEJ = auto-fail |
| T12 | **Rotating leadership** | Prevents one player dominating nominations. Universal in Resistance/Avalon variants. | Low | Planned | Capo rotation |
| T13 | **Onboarding / first-game tutorial** | Telegram game bots that don't explain themselves have massive drop-off. WerewolfBot has /rules, role wiki. | Medium | Planned | Intro sequence + /regler |

### Differentiators (Competitive Advantage)

These are features that either no competitor has, or that Golare implements in a fundamentally different way. These are why someone would choose Golare over @WerewolfBot.

| # | Feature | Value Proposition | Complexity | Golare v1 Status | Notes |
|---|---------|-------------------|------------|------------------|-------|
| D1 | **Async 5-day format** | No existing Telegram social deduction bot does async. This is Golare's core identity. Games unfold over a work-week with fixed daily events, fitting into real life rather than demanding 30 min of synchronized attention. Creates sustained paranoia -- players think about the game all day. | High | Planned | Biggest differentiator. Also biggest risk (see Pitfalls). |
| D2 | **AI Game Master (Guzman)** | No competitor has an AI-driven game master with personality. WerewolfBot is a mechanical narrator. Guzman actively stirs paranoia, generates dramatic mission narratives, whispers manipulative DMs, and fills gaps with commentary. This is the emotional engine of the game. | High | Planned | OpenAI GPT-4o powered. Cost management critical. |
| D3 | **AI Viskningar (Whispers)** | Between scheduled events, Guzman DMs players with suspicions, lies, and manipulation. No competitor does personalized AI-driven psychological warfare. Creates engagement between events -- the game is always "on." | High | Planned | Key anti-passivity mechanic for async format. |
| D4 | **Anti-passivity system (surveillance + anonymous whispers)** | The #1 problem in social deduction is eliminated/idle players doing nothing. Golare addresses this for non-team players: send anonymous messages via Guzman, surveil team members for cryptic clues. Blood on the Clocktower's "ghost mechanic" solves this for dead players; Golare solves it for non-selected players. | Medium | Planned | Critical for async -- players who have nothing to do for 12 hours will forget the game exists. |
| D5 | **Symmetrisk Sista Chansen (double endgame)** | Both sides get a comeback chance. Avalon only gives evil the Merlin assassination. Secret Hitler only gives liberals the assassination. Golare gives BOTH sides a final twist. This makes the last day extremely tense regardless of score. | Medium | Planned | Novel mechanic. Needs careful UX to explain. |
| D6 | **Themed immersion (Swedish suburb criminal underworld)** | WerewolfBot is generic medieval. Mafia bots are generic crime. Golare has a specific, vivid world: Betongen, fororten, Snabba Cash meets Top Boy. The slang (bre, shuno, aina, para) creates atmosphere no generic bot can match. | Medium | Planned | Language-specific. Limits international audience but creates strong identity for Swedish market. |
| D7 | **Anti-blowout mechanics (double points)** | Most social deduction games can feel decided by round 3. Golare's double-point final rounds ensure comeback possibility. No Telegram competitor does this. | Low | Planned | Simple to implement, high impact on game feel. |
| D8 | **Spaning (investigation tool)** | Every player gets one investigation per game. Unlike Avalon's Merlin (who knows all evil), this creates a scarce tactical resource. "When do I use my one shot?" is a compelling decision. Werewolf's Seer gets one check per night (renewable), but Golare's one-per-game version creates higher stakes. | Medium | Planned | Needs clear UX. Players must understand they have exactly one use. |
| D9 | **AI gap-fill commentary** | Guzman reacts to group chat activity between fixed times. If the group is quiet, Guzman provokes. If accusations fly, Guzman amplifies. No bot does this -- they all wait for commands. | High | Planned | Requires monitoring group chat + AI calls. Token cost implications. |

### Anti-Features (Commonly Requested, Often Problematic)

These are features that seem obvious but would actively harm Golare's design, especially given the async format.

| # | Feature | Why Requested | Why Problematic | Alternative |
|---|---------|---------------|-----------------|-------------|
| A1 | **Player elimination (killing players mid-game)** | Standard in Werewolf/Mafia. "Authentic social deduction." | In a 5-day game, being eliminated on day 1 means 4 days of watching. The Resistance/Avalon solved this by removing elimination entirely. Blood on the Clocktower solved it with ghosts. Golare must not eliminate players. | All players stay in every round. Non-team players get anti-passivity tools (whispers, surveillance). |
| A2 | **60+ roles like WerewolfBot** | "More roles = more replayability." | Complexity explosion. WerewolfBot took years to build 60+ roles. Golare's async format means players have hours between actions -- they need clarity, not complexity. 3 roles is correct for v1. | Start with 3 clear roles (Akta, Golare, Hogra Hand). Add 1-2 new roles per major version if warranted. |
| A3 | **Real-time synchronous play option** | "Sometimes we want a quick game." | Fundamentally different UX. Real-time requires all players online simultaneously. Would need separate game engine, different pacing, different AI prompting. Two games in one = neither done well. | Stay async. Let WerewolfBot handle synchronous. Golare is the async game. |
| A4 | **Voice messages / TTS** | "Hearing Guzman would be amazing." | High complexity (TTS integration, audio in Telegram, cost per message). Correctly deferred to v2. Would delay v1 significantly for a nice-to-have. | Text with strong formatting and slang creates Guzman's voice. Voice is v2 polish. |
| A5 | **Web dashboard / companion app** | "I want to see game history, stats, replays." | Splits attention from Telegram. Players would need to context-switch. The magic is that Golare lives entirely in the chat. | Keep everything in Telegram. Use /status, /regler, and end-of-game summaries. Consider web dashboard only for v3+ analytics. |
| A6 | **Configurable timers / schedule** | "Our group is active at different times." | Complexity for v1. Fixed schedule (09/12/15/18/21) is predictable and learnable. Custom timers require timezone handling, admin UI, edge cases. | Fixed schedule for v1. Configurable schedule is correctly scoped to v2. |
| A7 | **Multiple concurrent games per group** | "We have a big group, we want parallel games." | State management nightmare. Overlapping notifications. Confusing for players. WerewolfBot allows this but it causes constant confusion. | One game per group. Want another game? Make another group. |
| A8 | **Public vote tallies during voting** | "I want to see who voted what in real-time." | Kills social deduction. Public votes create bandwagoning. Avalon votes are simultaneous reveal. Secret Hitler has sequential but that is part of its specific design. | Votes are hidden until deadline. Results announced by Guzman simultaneously. |
| A9 | **Spectator mode** | "I want to watch without playing." | In async group chat, spectators see all group messages anyway. A formal spectator role adds complexity without value. In Telegram group context, everyone in the group can already see public messages. | No formal spectator mode needed. Non-players in the group naturally spectate. |
| A10 | **Achievements / badges / XP system** | "WerewolfBot has achievements, we want that." | Premature for v1. Achievements require many completed games to design meaningfully. WerewolfBot added achievements after millions of games. Focus on making the core game compelling first. | Defer entirely. If Golare reaches 1000+ completed games, design achievements based on real play patterns. |
| A11 | **AI players (filling empty slots)** | "We only have 3 friends online, let AI fill the rest." | AI cannot participate in the social deduction meta-game that happens outside the game (IRL conversations, reading tone in messages). An AI "player" in a text chat is just a chatbot pretending to have allegiances. Detectable and unsatisfying. | Minimum 4 human players. If you don't have 4, you don't play. Quality over accessibility. |
| A12 | **Screenshots / proof of role** | "Let players prove their role by sharing screenshots." | Completely breaks social deduction. If you can prove your role, there is no deduction. This is the #1 metagaming problem in online social deduction. | No screenshot-based proof mechanics. DM content is designed to be unverifiable. Guzman's answers to Spaning may be true or false specifically to prevent proof-sharing. |

---

## Feature Dependencies

```
Core Platform
  Bot registration (/start, /nyttspel)
    |
    v
  Role Assignment (Akta, Golare, Hogra Hand)
    |
    +---> Team-aware info (Golare see each other)
    |
    v
  Daily Game Loop
    |
    +---> Mission Posting (AI Guzman)  ---> requires OpenAI integration
    |
    +---> Capo Rotation + Team Nomination
    |       |
    |       v
    |     Group Voting (inline buttons)
    |       |
    |       +---> Kaos-mataren (3 NEJ = auto-fail)
    |       |
    |       v
    |     Mission Execution ([Sakra]/[Gola])
    |       |
    |       v
    |     Results + Score Update
    |
    +---> Anti-passivity (whispers, surveillance)  ---> requires DM infrastructure
    |
    +---> AI Viskningar  ---> requires OpenAI + player state tracking
    |
    +---> AI Gap-fill  ---> requires group chat monitoring + OpenAI
    |
    v
  Win Condition Check (best of 5)
    |
    v
  Symmetrisk Sista Chansen  ---> depends on final score
    |
    v
  Role Reveal + Game End
    |
    v
  Spaning (can be used anytime during game)  ---> independent of daily loop
```

**Key dependency insight:** The AI features (Guzman missions, Viskningar, gap-fill) all depend on OpenAI integration. This is a single point of failure. If OpenAI is down, the game must still function with fallback text.

**Critical path:** Bot registration -> Role assignment -> Daily loop (nomination -> vote -> execute -> results) -> Win condition -> End game. Everything else is enhancement on top of this skeleton.

---

## MVP Definition

### Launch With (v1 -- Must Ship)

These are required for the game to be playable and differentiated:

- [x] Bot registration (/start in DM, /nyttspel in group)
- [x] Secret role assignment (Akta, Golare, Hogra Hand) via DM
- [x] Role balancing (4-10 players, ~25% Golare)
- [x] Golare see each other's identities
- [x] Daily game loop with fixed schedule (09/12/15/18/21)
- [x] Capo rotation + team nomination
- [x] Group voting with inline buttons (JA/NEJ)
- [x] Kaos-mataren (3 NEJ = auto-fail)
- [x] Secret mission execution ([Sakra]/[Gola] via DM buttons)
- [x] Results announcement with score tracking
- [x] Win condition: best of 5 missions
- [x] Symmetrisk Sista Chansen (both sides get endgame chance)
- [x] Role reveal at game end (ADD THIS -- not explicitly in requirements)
- [x] AI Guzman: mission narratives, persona, dramatic results
- [x] AI Viskningar: DM players between events
- [x] Anti-passivity: anonymous whispers for non-team players
- [x] Anti-passivity: surveillance for cryptic clues
- [x] Spaning: one investigation per player per game
- [x] Anti-blowout: double points in final rounds
- [x] Onboarding intro sequence
- [x] /regler, /status commands
- [x] Game state persisted in Supabase
- [x] AI fallback: pre-written templates if OpenAI is unavailable

### Add After Validation (v1.x -- Based on Playtesting)

These should be built only after real players complete several games:

- [ ] **Reminder notifications**: Ping players who haven't voted/acted as deadline approaches. Critical for async but needs playtesting to find the right timing and tone.
- [ ] **Game summary / recap**: End-of-game narrative summary of key moments ("Dag 2: Ali gick med pa laget men gollade -- ingen misstankte nagot"). Requires tracking key events.
- [ ] **Player statistics**: Games played, win rate by role, average game performance. Requires enough completed games to be meaningful.
- [ ] **Adjustable notification verbosity**: Some players may find Guzman's DMs too frequent. Let players /tysta (mute) or /hogljudd (max notifications).
- [ ] **Re-match / play again**: Quick command to start a new game with same players after one ends.
- [ ] **Guzman personality variations**: Different AI personas for variety (paranoid, cold and calculating, chaotic). Same game, different narrator.

### Future Consideration (v2+)

- [ ] Voice messages / TTS for Guzman
- [ ] "The Wiretap" role (Golare intercepts Akta private messages)
- [ ] Configurable game length (3/5/7 days)
- [ ] Additional roles (max 1-2 per version)
- [ ] Cross-game persistent player reputation
- [ ] Tournament mode (series of games with leaderboard)
- [ ] Localization (English, other languages)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk if Deferred | Priority |
|---------|-----------|---------------------|------------------|----------|
| Secret role assignment + DM | Critical | Low | Game unplayable | P0 |
| Daily game loop (nominate/vote/execute) | Critical | Medium | Game unplayable | P0 |
| Inline button interactions | Critical | Medium | Unusable UX | P0 |
| Win condition + score tracking | Critical | Low | No game conclusion | P0 |
| Game state persistence (Supabase) | Critical | Medium | Data loss on restart | P0 |
| AI Guzman narratives | High | High | Loses core differentiator | P0 |
| Role reveal at game end | High | Low | Unsatisfying ending | P0 |
| Onboarding / /regler | High | Medium | New player confusion, drop-off | P0 |
| AI Viskningar (whispers) | High | High | Async feels dead between events | P1 |
| Anti-passivity (whispers + surveillance) | High | Medium | Non-team players disengage | P1 |
| Kaos-mataren | Medium | Low | Stalling possible but rare | P1 |
| Symmetrisk Sista Chansen | Medium | Medium | Less dramatic endings | P1 |
| Spaning (investigation) | Medium | Medium | Less tactical depth | P1 |
| Anti-blowout (double points) | Medium | Low | Blowouts feel bad but game still works | P2 |
| AI gap-fill commentary | Medium | High | Silence between events | P2 |
| Reminder notifications | High | Low | Players forget to act | v1.x |
| Game summary / recap | Medium | High | Players miss context | v1.x |
| Player statistics | Low | Medium | No progression feel | v1.x |
| AI fallback templates | High | Medium | Game breaks if OpenAI down | P0 |

---

## Competitor Feature Comparison

| Feature Category | WerewolfBot (Telegram) | Avalon Bot (Discord) | Secret Hitler (Web/Discord) | Golare Approach |
|-----------------|----------------------|---------------------|---------------------------|-----------------|
| **Format** | Synchronous, 5-15 min | Synchronous, ~30 min | Synchronous, ~30 min | Async, 5 days |
| **Player count** | 5-35 | 5-10 | 5-10 | 4-10 |
| **Roles** | 60+ | 6 (Merlin, Percival, Assassin, Morgana, Mordred, Oberon) | 3 (Liberal, Fascist, Hitler) | 3 (Akta, Golare, Hogra Hand) |
| **Player elimination** | Yes (core mechanic) | No | No | No |
| **Voting** | Lynch vote (day) | Approve/reject team | Ja/Nein on chancellor | JA/NEJ on team |
| **Secret actions** | Night kills, abilities | Quest success/fail | Policy selection | [Sakra]/[Gola] |
| **Failed vote penalty** | N/A | 5 rejects = auto-fail | 3 failed elections = policy | 3 NEJ = auto-fail (Kaos-mataren) |
| **Special knowledge role** | Seer (nightly checks) | Merlin (knows all evil) | N/A | Hogra Hand (one Spaning) |
| **Endgame twist** | N/A | Assassinate Merlin | N/A | Symmetrisk (both sides) |
| **Game master** | Mechanical bot narrator | Mechanical bot | Mechanical bot | AI persona (Guzman) with dynamic narrative |
| **Between-round engagement** | None | None | None | AI Viskningar, anonymous whispers, surveillance |
| **Achievements/stats** | Yes (extensive) | No | Basic stats | Deferred (v1.x) |
| **Onboarding** | /rules, !wiki per role | !help | Rules link | In-character intro + /regler |
| **Theme** | Generic medieval/horror | Arthurian | 1930s political | Swedish suburb criminal underworld |
| **Language** | 40+ languages | English (custom skins) | English | Swedish (with slang) |
| **Anti-passivity for non-team** | N/A (all active or dead) | None | None | Anonymous whispers, surveillance clues |
| **AI integration** | None | None | None | Full (OpenAI GPT-4o for GM persona) |

**Key takeaway from comparison:** Golare's competitive moat is the combination of async format + AI game master + anti-passivity system. No competitor has any of these three features. All three together create an experience that cannot be replicated by WerewolfBot adding a new role.

---

## Critical Feature Design Notes

### The Async Problem (Most Important Design Challenge)

Synchronous social deduction works because of real-time pressure: you have seconds to read someone's face, minutes to argue your case. Async removes this entirely. Golare must replace real-time pressure with:

1. **Anticipation pressure**: Knowing the vote result drops at 15:00 creates all-day tension
2. **Information drip**: AI Viskningar feed partial, potentially false info throughout the day
3. **Social pressure**: Anonymous whispers let players influence the group between events
4. **Scarcity pressure**: One Spaning per game means choosing when to use it is agonizing

If the between-event experience feels dead, the game fails. The AI features (D2, D3, D4, D9) are not nice-to-haves -- they are structural requirements of the async format.

### The Screenshot/Proof Problem

Online social deduction's biggest metagaming issue is players proving their role via screenshots. Golare's design already mitigates this:
- Spaning answers "may be true or false" -- so a screenshot proves nothing
- Guzman's whispers are personalized -- sharing them is possible but unreliable
- The game's social contract should explicitly state: "Guzman ljuger ibland. Lita inte pa nagon."

### The Notification Balance Problem

In a 5-day game with AI whispers and gap-fill, there is a real risk of notification fatigue. Players may mute the group chat, which kills engagement. Design principle: **fewer, higher-impact messages > constant stream**.

---

## Sources

- [Werewolf for Telegram (tgwerewolf.com)](https://www.tgwerewolf.com/) -- 5.9M+ players, 60+ roles, achievements system
- [Werewolf Bot Commands Wiki](https://werewolf.chat/Commands) -- comprehensive command reference
- [WerewolfBot GitHub (GreyWolfDev)](https://github.com/GreyWolfDev/Werewolf) -- open source implementation
- [Deloo's Avalon Bot (Discord)](https://top.gg/bot/699024385498939473) -- Avalon implementation with Lady of the Lake
- [Avalon Discord Bot (cameronleong)](https://github.com/cameronleong/avalon) -- open source Avalon bot
- [Secret Hitler (secrethitler.io)](https://secrethitler.io/) -- web implementation
- [Secret Hitler Discord Bot](https://sh-prime.org/) -- Discord implementation with auto-muting
- [Blood on the Clocktower](https://bloodontheclocktower.com/) -- ghost mechanic, storyteller role, information economy
- [Blood on the Clocktower Critical Analysis](https://mechanicsofmagic.com/2025/04/18/critical-play-2-competitive-analysis-blood-on-the-clocktower/) -- ghost mechanic solves elimination problem
- [AI Wolves Game (Ideatrix)](https://ideatrix.ai/) -- AI-powered social deduction with distinct AI personalities
- [Town of Salem](https://brandonthegamedev.com/town-of-salem-making-a-complex-social-deduction-game-with-simple-rules/) -- 50+ roles, investigation system
- [Untrusted: Web of Cybercrime](https://www.playuntrusted.com/) -- hacking-themed social deduction, log-based deduction
- [Social Deduction Game Design Fundamentals (BKGameDesign)](https://bkgamedesign.medium.com/social-deduction-game-design-fundamentals-a4cbae378005) -- design principles
- [The Problem With Social Deduction Board Games](https://bumblingthroughdungeons.com/the-problem-with-social-deduction-board-games/) -- elimination problem, engagement issues
- [Cheating in Social Deduction Games (BGG)](https://boardgamegeek.com/thread/2883528/cheating-in-social-deduction-games) -- metagaming prevention
- [The Resistance: Avalon Rules](https://avalon-game.com/wiki/rules/) -- original game mechanics reference
- [Telegram Bot API: Buttons](https://core.telegram.org/api/bots/buttons) -- inline keyboard capabilities
- [Telegram Onboarding Kit (GitHub)](https://github.com/Easterok/telegram-onboarding-kit) -- onboarding patterns for Telegram bots
- [Mafia Bot GitHub (AndreaZChen)](https://github.com/AndreaZChen/Mafia-Bot) -- Python Telegram Mafia bot reference
- [What Makes Social Games Social? (Gamedeveloper.com)](https://www.gamedeveloper.com/disciplines/what-makes-social-games-social-) -- async vs sync engagement

---
*Feature research for: Golare -- Telegram Bot Async Social Deduction Game*
*Researched: 2026-02-10*
