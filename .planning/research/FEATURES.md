# Feature Research: AI Behavioral Awareness (v1.1)

**Domain:** AI Game Master behavioral tracking and message-aware reactions in async social deduction
**Researched:** 2026-02-11
**Confidence:** MEDIUM (novel domain -- no direct comparable exists; patterns synthesized from AI NPC research, LLM agent social deduction studies, and chat memory management best practices)

---

## Context: What Exists in v1

Guzman (the AI game master) currently operates on **game state data only** -- he knows scores, team compositions, vote results, round phases, and narrative context. He does NOT know what players actually write in the group chat. His gap-fill commentary reacts to message *count* (quiet group = < 2 messages in 2 hours) but not message *content*.

The `GuzmanContext` type already has a `playerNotes: Record<string, string>` field that is populated with whisper history but never with actual player chat data. The `gatherRoundEvents()` helper in both `whisper-handler.ts` and `engagement.ts` builds observable context (scores, team, votes) but zero chat content.

**The gap:** Guzman talks ABOUT players but never reacts to what they ACTUALLY SAY. He is a paranoid leader who somehow never listens to the room.

---

## Table Stakes (Required for Behavioral AI to Work)

These must exist before any behavioral feature can function. Without them, attempts at "awareness" will produce hallucinations, wrong attributions, or empty references.

| # | Feature | Why Required | Complexity | Depends On |
|---|---------|-------------|------------|------------|
| T1 | **Message capture middleware** | Must intercept all group text messages during active games. grammY's `bot.on("message:text")` in group chats, with privacy mode disabled via BotFather. Store sender ID, text, timestamp. This is the raw data pipeline. | Low | BotFather privacy mode disabled (already required for gap-fill activity tracking in v1) |
| T2 | **Per-player message ring buffer (DB)** | Store last ~10 messages per player per game. NOT unlimited history -- bounded storage prevents cost explosion in AI context windows and respects the "recent behavior" principle. Ring buffer semantics: when 11th message arrives, oldest drops. | Medium | T1, new DB table `player_messages` |
| T3 | **Player activity stats (computed)** | Derived metrics from stored messages: message count per day, time-of-day pattern, average message length, days since last message. These are cheap to compute and give Guzman "instinct" without needing full LLM analysis of every message. | Low | T2 |
| T4 | **Chat context builder for AI prompts** | Function that assembles a player's recent messages + activity stats into a prompt-injectable string. Must be token-aware (cap at ~500 tokens per player context to keep AI calls affordable). Analogous to `gatherRoundEvents()` but for chat behavior. | Medium | T2, T3 |
| T5 | **Message content filtering** | Strip bot commands, system messages, stickers-only messages, and messages shorter than 3 characters before storage. Only meaningful player communication should inform Guzman. | Low | T1 |

**Complexity note:** T1 and T5 are essentially extending the existing `trackGroupMessage()` function in `whisper-handler.ts` from counting to capturing. The middleware hook already exists -- it just needs to do more.

---

## Differentiators (What Makes This Special)

These are the features that make Guzman feel genuinely aware rather than producing generic "I'm watching you" commentary. The difference between "AI that monitors chat" and "AI that PLAYS the social game."

| # | Feature | Value Proposition | Complexity | Depends On |
|---|---------|-------------------|------------|------------|
| D1 | **Oblique message references in whispers** | Guzman's DM whispers paraphrase or twist things a player said in group chat. NOT direct quotes -- oblique, paranoia-inducing references. "Du sa natt intressant till gruppen forut... jag undrar om du menade det pa riktigt." This is the core "wow, he's listening" moment. | Medium | T4, existing whisper prompt system |
| D2 | **Silence-calling in group** | Guzman publicly calls out players who have not written anything in the group chat for extended periods (e.g., 6+ hours during active game hours). "Varfor ar du sa tyst, [Name]? Nagon som tiger har natt att gomma." Paranoia amplifier. Distinct from gap-fill (which reacts to overall group quiet) -- this targets INDIVIDUALS. | Low | T3 |
| D3 | **Activity-adapted mission narratives** | Mission posts reference the group's recent energy. If the group was arguing heatedly before the mission, Guzman acknowledges the tension. If the group was dead quiet, Guzman comments on the suspicious silence. The narrative feels reactive to the real social situation. | Medium | T3, T4, existing mission narrative prompts |
| D4 | **Behavioral whisper triggers** | New event-trigger types beyond the existing `mission_failed`, `close_vote`, `kaos_triggered`. Add: `player_accused` (someone accused another by name), `heated_exchange` (rapid back-and-forth between two players), `sudden_silence` (active player goes quiet). These create reactive whispers that feel timely. | High | T2, T3, message pattern detection logic |
| D5 | **Mood-aware gap-fill** | Current gap-fill knows "group is quiet." Behavioral gap-fill also knows the GROUP MOOD: were the last messages accusatory? Friendly? Nervous? Guzman's gap-fill commentary adapts. Accusatory mood = "Bra, bra... misstanksamhet haller oss vid liv." Friendly mood = "Ni ar lite VAL mysiga for en liga dar nagon ar en rata." | Medium | T4, existing gap-fill system |
| D6 | **Player behavioral profiles in GuzmanContext** | Extend `playerNotes` to include AI-generated behavioral summaries: "Ahmed has been the most vocal accuser. Sara deflects with humor. Ali has been unusually quiet since round 3." Updated after each round, these compound across the game, giving Guzman a persistent "read" on each player. | Medium | T3, T4, existing GuzmanContext update cycle |
| D7 | **Accusation tracking** | Detect when players accuse each other by name in group chat (heuristic: message contains another player's name + suspicious/accusatory keywords). Feed this to AI context as social graph data. "Ahmed anklagade Sara 3 ganger. Sara har inte namnt Ahmed alls." | Medium | T2, player name matching |

---

## Anti-Features (Things to Deliberately NOT Build)

These are tempting but would make the experience worse -- either by breaking immersion, creating an adversarial surveillance feeling, or adding complexity that does not serve the social deduction core.

| # | Anti-Feature | Why Tempting | Why Harmful | What to Do Instead |
|---|-------------|-------------|-------------|-------------------|
| A1 | **Expose activity stats to players** | "Show everyone who is most/least active as a leaderboard." | Turns the game from social deduction into activity optimization. Quiet players get socially punished by the group, not by Guzman's paranoia. Kills the organic social dynamic. Stats should be INTERNAL -- Guzman's private intelligence, not public data. | Stats feed AI prompts only. Players never see raw numbers. |
| A2 | **Direct quoting of player messages** | "Guzman should quote exactly what someone said." | Direct quotes feel like surveillance, not like a paranoid leader's instinct. They also create a provable record -- players can verify if Guzman is lying about what was said. Oblique references preserve ambiguity ("Vem sa forut att de 'litar pa alla'? Intressant ordval..."). Direct quotes feel mechanical; oblique references feel human. | Always paraphrase, twist, or reference obliquely. Never use quotation marks around actual player text in Guzman's output. |
| A3 | **Sentiment scores visible anywhere** | "Show a mood indicator per player." | Same problem as A1 but worse. Sentiment is inherently noisy. Displaying "Sara: SUSPICIOUS" as a visible label would be both inaccurate and game-breaking. Players would game their writing style to manipulate the score. | Sentiment is a soft signal in AI prompts, never a displayed value. |
| A4 | **Real-time reactive messages to every notable chat event** | "Guzman should respond every time someone accuses someone." | Notification fatigue. The research is clear: AI reactions that repeat become annoying quickly, even if initially surprising. Guzman should react to behavior in SCHEDULED outputs (whispers, gap-fill, missions), not as a live chat participant. The delay between stimulus and reaction is what creates paranoia -- "He noticed... but when will he say something?" | Behavioral data feeds scheduled AI outputs. Guzman reacts on his own timeline, not as a chatbot. |
| A5 | **Full message history storage** | "Store ALL messages for complete context." | Cost explosion in both storage and AI tokens. A 10-player game over 5 days might generate 500-1000 group messages. Feeding all of that into every AI call would be prohibitively expensive and would dilute the signal. The last ~10 messages per player captures recent behavior without drowning in noise. | Ring buffer of ~10 messages per player. Older messages are summarized into behavioral profiles (D6), not preserved verbatim. |
| A6 | **Automated lie detection** | "Use AI to detect if a player is lying based on their messages." | The game IS about lying. Automated detection would break the core mechanic. Also, LLM "lie detection" from text is unreliable and would produce false positives that feel unfair. | Guzman can SPECULATE about honesty based on behavioral patterns ("du beter dig annorlunda sen runda 3"), but never claim certainty. |
| A7 | **Player-visible "Guzman is watching" indicator** | "Show a typing indicator or eye emoji when Guzman processes a message." | Creates self-censorship. Players should forget the bot is reading and write naturally. The magic is when Guzman references something hours later in a whisper and the player thinks "wait, he reads everything?" The moment of realization is better than constant awareness. | No visual indicators of message processing. Silent capture. |
| A8 | **Per-message AI analysis** | "Run each message through the LLM for sentiment/intent analysis." | Cost: at $0.15/1M input tokens for gpt-4.1-nano, analyzing 500+ messages per game individually would be expensive AND slow. Also unnecessary -- batch analysis at scheduled intervals is both cheaper and produces better context. | Analyze in batch at whisper/gap-fill/mission generation time, not per-message. |

---

## How AI Should Reference Player Messages

This is the most important design question for v1.1. Get it wrong and Guzman feels either creepy or robotic.

### The Spectrum of Reference

| Style | Example | Effect | Verdict |
|-------|---------|--------|---------|
| **Direct quote** | "Du sa 'jag litar pa Sara' klockan 14:32." | Surveillance feeling. Provably accurate. Breaks ambiguity. | NEVER use |
| **Close paraphrase** | "Du sa att du litar pa Sara forut." | Still feels like surveillance but slightly softer. Player knows exactly which message is referenced. | AVOID except in rare high-impact whispers |
| **Oblique reference** | "Jag horde att nagon snackade om foretroende i gruppen... intressant ordval just nu." | Creates paranoia without pinpointing. Player wonders: "Does he mean MY message?" | PRIMARY METHOD |
| **Behavioral pattern** | "Du har varit valdig aktiv med att forsvara Ahmed. Varfor?" | References accumulated behavior, not a specific message. Feels like Guzman has been OBSERVING over time. | PRIMARY METHOD |
| **Atmospheric reference** | "Stormigt i chatten idag, bre. Jag gillar det -- nar ni brakar ser jag vem som svettas." | References group mood without targeting anyone. Sets tone. | GOOD for gap-fill and mission narratives |
| **Twisted reference** | "Nagon i gruppen antydde att de 'visste vem golare ar'... men sa nagon verkligen det?" | Guzman attributes something slightly different from what was actually said, creating confusion. Did someone say that? Classic unreliable narrator. | HIGH-VALUE differentiator -- use sparingly |

### The Design Principle

**Guzman is an unreliable narrator with good ears.** He hears everything but filters it through his paranoid worldview. He never quotes. He paraphrases with bias. He sometimes invents or exaggerates. Players should never be 100% sure if Guzman's reference to their message is accurate or distorted.

This maps perfectly to the existing whisper truth_level system: `truth`, `half_truth`, `lie`. Apply the same framework to message references:
- **truth**: Accurately paraphrased behavioral observation ("du har anklagat Ahmed tre ganger idag")
- **half_truth**: Real observation with distorted interpretation ("du forsvarade Sara -- kanske lite FOR ivrigt?")
- **lie**: Fabricated or exaggerated reference ("jag horde att du lovade nagon att du skulle rosta ja... stammer det?")

---

## Frequency and Timing of Behavioral Reactions

### How Often Should Guzman React to Behavior?

The research is unambiguous: AI reactions that repeat become annoying, even if initially surprising. Cooldowns and variety are essential.

| Output Type | Current Cadence (v1) | v1.1 Behavioral Enhancement | Rationale |
|------------|---------------------|------------------------------|-----------|
| **Whispers (DM)** | 2x daily (13:00, 19:00), 1-2 players each | Same cadence, but whisper CONTENT now references player behavior. No new sends -- richer content in existing sends. | Zero notification increase. Higher quality. |
| **Gap-fill (group)** | When group quiet (< 2 msgs/2hr) | Same trigger, but content references recent group mood/behavior. Plus new trigger: individual silence call-outs (max 1 per player per day). | Slight increase but only when already quiet. Natural. |
| **Mission narratives** | 1x daily (09:00) | Same cadence, content references previous day's group energy. | Zero notification increase. |
| **Behavioral accusations (NEW)** | N/A | Max 1 per day, in group chat, during gap-fill window. Guzman calls out a specific behavioral pattern. "Varfor har [Name] varit sa tyst sedan stoten misslyckades?" | One new message type. Rate-limited to prevent annoyance. |

### The "Last Straw" Rule

Guzman should never reference the same player's behavior more than twice per day across ALL output types combined. If Ahmed was called out in a whisper AND in a gap-fill comment, he should not be mentioned in the mission narrative that same day. Spread attention across players.

### Timing Matters

Behavioral references are most impactful when DELAYED from the triggering message:
- Player posts something suspicious at 10:00
- Guzman's scheduled whisper at 13:00 obliquely references it
- 3-hour delay creates "wait, he noticed?" moment

This is inherent to the scheduled architecture. Do NOT add real-time reactive messages (see Anti-Feature A4).

---

## Feature Dependencies

```
v1 Existing Infrastructure
  |
  +---> trackGroupMessage() [whisper-handler.ts]  -- already counts messages per group
  |       |
  |       v
  |     T1: Message capture middleware  -- extend from counting to capturing
  |       |
  |       +---> T5: Content filtering  -- strip commands, system msgs
  |       |
  |       v
  |     T2: Per-player message ring buffer (DB)
  |       |
  |       +---> T3: Player activity stats (derived)
  |       |       |
  |       |       +---> D2: Silence-calling
  |       |       +---> D3: Activity-adapted narratives
  |       |
  |       +---> T4: Chat context builder
  |       |       |
  |       |       +---> D1: Oblique message references in whispers
  |       |       +---> D5: Mood-aware gap-fill
  |       |       +---> D6: Behavioral profiles in GuzmanContext
  |       |
  |       +---> D7: Accusation tracking
  |               |
  |               v
  |             D4: Behavioral whisper triggers
  |
  v
v1 Existing AI System
  |
  +---> buildWhisperPrompt()  -- inject T4 chat context
  +---> buildGapFillPrompt()  -- inject T4 chat context + mood
  +---> buildMissionPrompt()  -- inject T3 activity stats
  +---> updateNarrativeContext()  -- append D6 behavioral profiles
```

**Critical insight:** The dependency graph shows that T1-T2-T4 is the critical path. Everything else branches from having captured messages available in a context builder. The AI prompt modifications (D1, D3, D5) are then relatively small changes to existing prompt builder functions.

---

## MVP Recommendation for v1.1

### Phase 1: Data Pipeline (ship first)

1. **T1: Message capture middleware** -- extend `trackGroupMessage()` to store message content
2. **T5: Content filtering** -- basic filtering before storage
3. **T2: Per-player ring buffer** -- new `player_messages` table, 10 messages max per player per game
4. **T3: Activity stats** -- computed on read, not stored separately

### Phase 2: AI Integration (ship second)

5. **T4: Chat context builder** -- token-aware prompt injection function
6. **D1: Oblique references in whispers** -- modify `buildWhisperPrompt()` to include chat context
7. **D5: Mood-aware gap-fill** -- modify `buildGapFillPrompt()` to include chat mood
8. **D3: Activity-adapted narratives** -- modify `buildMissionPrompt()` with activity data

### Phase 3: Advanced Behavioral Features (ship third)

9. **D2: Individual silence-calling** -- new gap-fill variant targeting quiet players
10. **D6: Behavioral profiles** -- extend `updateNarrativeContext()` to generate per-player summaries
11. **D7: Accusation tracking** -- heuristic detection + social graph data
12. **D4: Behavioral triggers** -- new whisper trigger types based on D7

### Defer to v1.2+

- Twisted references (the "unreliable narrator" fabrication feature) -- needs careful prompt engineering and testing to avoid confusion between intentional AI fabrication and AI hallucination
- Cross-game behavioral memory (player tendencies across multiple games)

---

## Sources

- [LLM Chat History Summarization Guide (mem0.ai)](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) -- sliding window and summarization patterns for chat memory
- [Context Window Management Strategies (apxml.com)](https://apxml.com/courses/langchain-production-llm/chapter-3-advanced-memory-management/context-window-management) -- FIFO queue for conversation memory
- [Microscopic Analysis on LLM Players via Social Deduction Game (arXiv)](https://arxiv.org/html/2408.09946v1) -- fine-grained behavioral metrics (accusation rate, camouflage, vote rate)
- [Finding Deceivers with LLMs in Mafia (Nature Scientific Reports)](https://www.nature.com/articles/s41598-024-81997-5) -- LLM deception detection from partial information
- [On the Importance of Reactions in Game AI (gamedeveloper.com)](https://www.gamedeveloper.com/design/you-had-me-at-aaaahhh-on-the-importance-of-reactions-in-game-ai) -- cooldowns, variety, annoyance thresholds for AI reactions
- [Inworld AI: Fourth Wall and NPC Design](https://inworld.ai/blog/ai-npcs-and-the-future-of-video-games) -- managing fourth wall boundaries, player profiles, relationship progression
- [Ubisoft NEO NPC: Authenticity Boundaries](https://news.ubisoft.com/en-us/article/5qXdxhshJBXoanFZApdG3L/how-ubisofts-new-generative-ai-prototype-changes-the-narrative-for-npcs) -- balancing NPC awareness vs breaking character
- [grammY Filter Queries (grammy.dev)](https://grammy.dev/guide/filter-queries) -- message type filtering for bot middleware
- [Telegram Bot Privacy Mode (core.telegram.org)](https://core.telegram.org/bots/faq) -- disabling privacy mode for full group message access
- [Social Deduction Game Design Fundamentals (BKGameDesign)](https://bkgamedesign.medium.com/social-deduction-game-design-fundamentals-a4cbae378005) -- player behavior observation as core mechanic
- [LLM Sentiment Analysis for Gaming (zenml.io)](https://www.zenml.io/llmops-database/large-language-models-for-game-player-sentiment-analysis-and-retention) -- lightweight sentiment analysis in game contexts
- [Chatbot Design Guide 2026 (jotform.com)](https://www.jotform.com/ai/agents/chatbot-design/) -- pacing controls and interaction frequency management

---
*Feature research for: Golare v1.1 -- AI Behavioral Awareness*
*Researched: 2026-02-11*
