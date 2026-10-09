---
title: Toado 🐸 a little garden helper for our first real garden
published: false
tags: devchallenge, hf26challenge, gemma, ollama
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

This year my partner and I moved to a farm in Värmland, Sweden. The house dates from the early 1900s, and it came with our first real garden. It's a big one. There are fruit trees, bushes and beds, and a greenhouse. Quite a few of the plants were here long before us, and we honestly don't know what all of them are yet.

We both work as developers, so of course our first idea was to build something. **Toado** is a small garden helper for our household: me, my partner and, when he's older, maybe our son. I love frogs, so it got a toad.

What we wanted it to do:

- **Tell us what needs doing outside today.** It should base this on the season, the weather and what we've already done. It should remind us to open the greenhouse on a warm day, cover things on a frosty night, or water something we haven't watered for a while.
- **Help us understand the work.** A garden this size is new to us. We'd like a realistic picture of what needs doing and when, so that it feels like something we can manage.
- **Fill in what we don't know.** We can take a photo of a plant we don't recognise or a leaf that looks wrong, and ask about it.
- **Keep a record.** It should keep track of what we've watered, pruned and harvested, and what happened to each plant.
- **Stay ours.** Our garden, our home and our photos stay on our own computer, and we can customise everything.

Each morning Toado shows one card with a few jobs for today. Here's what it suggested on a windy October morning:

> **Today in your garden**
> It looks like a windy and wet autumn day in Forshaga, but there is still plenty of light to get some clearing done. Grab your raincoat and let's tidy up the garden before the rain settles in!
>
> 🧺 **Harvest apples and pears.** Pick the pears while they are still firm and let them finish ripening indoors.
> 🧹 **Clear out the greenhouse plants.** Compost the healthy leaves from the finished tomatoes, squash, cucumber, radishes and mild chili so pests have nowhere to overwinter.
> 🧹 **Clear finished plants from pallet collars.** Compost the healthy leaves from the finished potatoes, peas, cabbage and broccoli…

When we've done a job, we tick it and it goes into the log. The log also helps Toado: once we've watered something, it waits before suggesting it again.

## Demo

[TODO: video, about 90 seconds. Suggested shots: open the app in the morning → the Today card → go outside → photograph a plant or leaf → Ask → tick a job → the log.]

[TODO: 2–3 screenshots: the Today card, a photo question in Ask, the plant editor.]

Toado runs Gemma through Ollama on our own computer, so there's no hosted version to click through. If you'd like to try it, the README explains how to run it. The first screen has a **demo garden** button that loads a garden like ours.

## Code

{% embed https://github.com/zarasyversen/Toado %}

It's Vite and TypeScript with no framework, plus 60 tests, and MIT licensed.

## How I Built It

**The open pieces:**
- **Gemma 4** (`gemma4:26b`), running locally with **Ollama** on my Mac.
- **Open-Meteo** for the forecast, recent rain and past frost dates. It needs no API key.
- The app itself is a small PWA, so we can add it to our home screens.

### Rules for the facts, Gemma for the rest

We didn't want to rely on a language model for things like "is it below freezing tonight?". So Toado works in two steps.

**First, a set of plain TypeScript rules works out which jobs could make sense today:**
- **Greenhouse:** open it on a warm or sunny day, and close it in the evening if the night will be cold.
- **Frost:** compare tonight's low with how much cold each plant can take. A plant in a pot can take less cold, and one under cover more.
- **Watering:** how long since we last watered, whether it has rained, and whether it's hot. Pots dry out faster.
- **Seasonal care:** the months when each plant should be sown, pruned, fed, mulched or harvested.

These rules don't use AI, so we can test them. They're also the part we most want to be right.

**Then Gemma gets that list.** It picks a handful of jobs for today, groups them, words them in plain language and writes a short summary of the day. Its answer has to match a schema that only allows the jobs from the list, so it can choose and rephrase, but it can't add a job of its own. If Ollama isn't running, Toado just shows the rules' list instead.

### Getting to know what we have

Toado has care information for 40 common garden plants built in. Many of ours are more specific than that, or not on the list at all. So when we add a plant, we can ask Gemma for a suggestion: how often to water it, how much frost it can take, and which months to do what. The plant can be a variety, like our Melonäpple apple tree, which ripens a few weeks after our other one. The suggestion goes into a month grid that we check and correct before saving, because Gemma can be wrong.

### Asking with a photo

Gemma 4 can look at images. With so many plants we don't know yet, we expect this to be the part we use most. In **Ask the garden** we can attach a photo and ask a question. Gemma gets our garden as context too: the plants, the log and the weather this week. I tried it with a photo of an apple leaf with reddish-brown spots, and it answered:

> I can see reddish-brown, irregular blotches on your Melonäpple leaf. It is likely apple scab, which thrives in the damp, rainy weather we are having here in Forshaga this October. To be sure, check the underside of the leaf; scab often looks dusty or fuzzy there… Go outside and check if the spots are appearing on the fruit itself.

We asked it to say what it can see, how sure it is and what to check outside. We think that's more useful than a confident diagnosis, and it gets us outside to look.

## Why Does Open Innovation Matter?

For us, it mostly comes down to three things.

**Our data stays at home.** A garden app knows a lot: where we live, what we grow, when we're out there, and now photos of our home. With Gemma running locally, none of that leaves our computer. The only thing sent out is our location, to Open-Meteo, for the forecast.

**We can make it completely ours.** It's our code and our model, running on our machine. We can change the rules, add our own plants and try other models; `VITE_OLLAMA_MODEL` sets which one it uses. There's no account and no API key.

**It doesn't cost anything to use.** Toado asks Gemma whenever something changes: a new day, a new plant, a ticked job, a question. With a paid API we'd probably have held back on that. Running it ourselves, we didn't have to think about it.

**What hasn't worked so well:**
- **Speed:** the model needs a fairly powerful computer (it takes about 16 GB of memory). A question with a photo takes around 25 seconds to answer the first time, though follow-up questions about the same photo are much quicker.
- **Phones:** they can't run Gemma, so for now the questions happen on the computer.
- **Mistakes:** Gemma sometimes gets things wrong. In one answer it suggested composting leaves with apple scab, which is usually advised against. That's part of why the important facts come from the rules, and why we check what it suggests.

**What we'd like to do next** is make Toado shared, so my partner and I (and one day our son) can all use it from our phones. The plan is for the computer at home that runs Gemma to also hold the garden and the log. That way the data still stays in the house.

## Took It Outside

[TODO, in your own words. Some prompts:
- A plant you inherited that Gemma helped you identify (or didn't).
- A morning you followed Toado's list. What did you do, and how long did it take?
- What you've learned about how much work the garden needs.
- Something it got wrong.
- A photo from the garden.]

## My Agent Session

I built Toado together with Claude Code. We started from a written plan and went step by step: weather and climate first, then the rules, then Gemma, then the app itself. I reviewed and tried out each step before moving on. Plenty changed on the way:

- **The first idea was too narrow.** It started out mostly about frost dates. That didn't fit a garden like ours, so it became a year-round helper built around our own plants, the season and the weather.
- **Varieties got added.** That came from realising our two apple trees ripen weeks apart.
- **Gemma needed some help.** At first it misread the weather and said tonight would be 3 °C when the forecast low was −2 °C, so now the prompt states tonight's low directly. It also called a gooseberry a flower, and its first suggestions were a bit vague.
- **A code review caught real bugs.** One was editing a plant changing the shared care profile for every plant of that kind. Another was the plan missing jobs after changing location.
- **Testing it ourselves helped most.** I got stuck in the demo garden with no way back, so that got fixed. When I found out Gemma could read images, we added photo questions.
- **The look is ours.** The colours come from a palette I picked.

## Prize Categories

- **Best Use of Gemma**: Gemma 4 runs locally through Ollama. It plans the day's jobs, suggests care for plants and varieties, answers questions about the garden and looks at photos.
