---
title: Toado 🐸 a little garden helper for our first real garden
published: false
tags: devchallenge, hf26challenge, gemma, ollama
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05)*

## What I Built

This year my partner and I moved to a farm in Värmland, Sweden. The house dates from the early 1900s, and it came with our first real garden. It's a big one. There are fruit trees, bushes and beds, and a greenhouse. Quite a few of the plants were here long before us, and we honestly don't know what all of them are yet.

My partner and I are both developers, so building something of our own for the farm felt like fun. **Toado** is the small garden helper I built for us: me, my partner and, when he's older, maybe our son. I love frogs, so it got a toad.

What I wanted it to do:

- **Tell me what needs doing outside today.** It should base this on the season, the weather and what I've already done. It should remind me to open the greenhouse on a warm day, cover things on a frosty night, or water something I haven't watered for a while.
- **Help me understand the work.** I'd like a realistic picture of how much a garden this size needs, and when.
- **Fill in what I don't know.** I can take a photo of a plant I don't recognise or a leaf that looks wrong, and ask about it.
- **Keep a record** of what I've watered, pruned and harvested, and what happened to each plant.
- **Stay local and mine.** The garden, the home and the photos stay on my own computer, and I can customise everything.

Each morning Toado shows one card with a few jobs for today. Here's what it suggested on a windy October morning:

> **Today in your garden**
> It looks like a windy and wet autumn day in Forshaga, but there is still plenty of light to get some clearing done. Grab your raincoat and let's tidy up the garden before the rain settles in!
>
> 🧺 **Harvest apples and pears.** Pick the pears while they are still firm and let them finish ripening indoors.
> 🧹 **Clear out the greenhouse plants.** Compost the healthy leaves from the finished tomatoes, squash, cucumber, radishes and mild chili so pests have nowhere to overwinter.
> 🧹 **Clear finished plants from pallet collars.** Compost the healthy leaves from the finished potatoes, peas, cabbage and broccoli…

When I've done a job, I tick it and it goes into the log. Toado reads the log too: once I've watered something, it waits before suggesting it again.

## Demo

In this one-minute video I'm in the garden. I take a photo of the pallet collars I've just cleared and ask Gemma whether I can leave them like that over winter.

[![Gemma's answer about the pallet collars. Click to watch the video](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/gemma-pallet-answer.jpg)](https://github.com/user-attachments/assets/201d0daa-0c43-4d82-b76b-b93534b55aad)

**▶️ [Watch the video (1 minute)](https://github.com/user-attachments/assets/fd8647ad-5136-495f-81fe-72254f2479eb)**

The day's plan, the same jobs all ticked off, and the log of what I did:

![Today's plan from Gemma](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/app-today.jpg)
![All of today's jobs done](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/app-today-done.jpg)
![The garden log](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/app-log.jpg)

Toado runs Gemma through Ollama on my own computer, so there's no hosted version to click through. I used it on my phone through Tailscale. If you'd like to try it, the README explains how to run it. The first screen has a **demo garden** button that loads a garden like ours.

## Code

{% embed https://github.com/zarasyversen/Toado %}

It's Vite and TypeScript with no framework, plus 60 tests, and MIT licensed.

## How I Built It

**The open pieces:**
- **Gemma 4** (`gemma4:26b`), running locally with **Ollama** on my Mac.
- **Open-Meteo** for the forecast, recent rain and past frost dates. It needs no API key.
- The app itself is a small PWA, so I can add it to my phone's home screen.

### Rules for the facts, Gemma for the rest

I didn't want to rely on a language model for things like "is it below freezing tonight?". So Toado works in two steps.

**First, plain TypeScript rules work out which jobs could make sense today:**
- **Greenhouse:** open it on a warm or sunny day, and close it in the evening if the night will be cold.
- **Frost:** compare tonight's low with how much cold each plant can take. A plant in a pot can take less cold, and one under cover more.
- **Watering:** how long since I last watered, whether it has rained, and whether it's hot. Pots dry out faster.
- **Seasonal care:** the months when each plant should be sown, pruned, fed, mulched or harvested.

These rules don't use AI, so I can test them, and they're the part I most want to be right.

**Then Gemma gets that list.** It picks a handful of jobs for today, groups them, words them in plain language and writes a short summary of the day. Its answer has to match a schema that only allows the jobs from the list, so it can choose and rephrase, but it can't add a job of its own. If Ollama isn't running, Toado just shows the rules' list instead.

### Getting to know what I have

Toado has care information for 40 common garden plants built in. When I add a plant that's more specific than that, or not on the list at all, I can ask Gemma for a suggestion: how often to water it, how much frost it can take, and which months to do what. The plant can be a variety, like my Melonäpple apple tree, which ripens a few weeks after the other one. The suggestion goes into a month grid that I check and correct before saving, because Gemma can be wrong.

### Asking with a photo

Gemma 4 can look at images. In **Ask the garden** I can attach a photo and ask a question. Gemma gets my garden as context too: the plants, the log and this week's weather. I tried it with a photo of an apple leaf with reddish-brown spots, and it answered:

> I can see reddish-brown, irregular blotches on your Melonäpple leaf. It is likely apple scab, which thrives in the damp, rainy weather we are having here in Forshaga this October. To be sure, check the underside of the leaf; scab often looks dusty or fuzzy there… Go outside and check if the spots are appearing on the fruit itself.

I asked it to say what it can see, how sure it is and what to check outside. I think that's more useful than a confident diagnosis, and it sends me outside to look.

## Why Does Open Innovation Matter?

For me, it mostly comes down to three things.

**The data stays at home.** A garden app knows a lot: where I live, what I grow, when I'm out there, and now photos of our home. With Gemma running locally, none of that leaves my computer. The only thing sent out is the location, to Open-Meteo, for the forecast.

**I can make it completely mine.** It's my code and my model, running on my machine. I can change the rules, add my own plants and try other models; `VITE_OLLAMA_MODEL` sets which one it uses. There's no account and no API key.

**It doesn't cost anything to use.** Toado asks Gemma whenever something changes: a new day, a new plant, a ticked job, a question. With a paid API I'd probably have held back on that. Running it myself, I didn't have to think about it.

**What hasn't worked so well:**
- **Speed:** the model needs a fairly powerful computer (it takes about 16 GB of memory). A question with a photo takes around 25 seconds to answer the first time, though follow-up questions about the same photo are much quicker.
- **Phones:** a phone can't run Gemma. I use Toado on my phone through Tailscale, which lets it reach my Mac at home privately. That only works while the Mac is awake.
- **Mistakes:** Gemma sometimes gets things wrong. In one answer it suggested composting leaves with apple scab, which is usually advised against. That's part of why the important facts come from the rules, and why I check what it suggests.

## Future Ideas

- **Share it between our devices.** The garden and the log should live on the computer at home, so my partner and I can use the same garden from our own phones. The data still stays in the house.
- **Real phone notifications** when something needs doing, like "close the greenhouse door, it'll be cold tonight".
- **A garden calendar** with a photo for each day. Over the seasons that would become a diary of how the garden changes.
- **Notes for the future.** If I do something in autumn that matters in spring, like planting bulbs or covering a bed, I'd like to write a note and have Toado remind me when the time comes.
- **More rules.** The TypeScript rules are only a start. Because they're plain code, I can keep adding rules that fit this particular garden as I learn what it needs.

## Took It Outside

Today was a rainy Saturday, and I spent it outside doing what Toado suggested: harvest the last apples and pears, empty the greenhouse and clear the pallet collars.

![Me in the greenhouse in rain gear](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/me-in-the-greenhouse.jpg)

The greenhouse was full of finished tomatoes, squash, cucumbers and chillies. This is before and after:

![The greenhouse before clearing](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/greenhouse-before.jpg)
![The greenhouse after clearing](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/greenhouse-after.jpg)

Then the pallet collars. Clearing them turned up a bowl of potatoes.

![The pallet collars](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/pallet-collars.jpg)
![Potatoes dug up from the pallet collars](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/potatoes.jpg)

When the collars were empty, I wasn't sure whether to just leave them like that over winter. That's the question in the demo video. Gemma took about 20 seconds to answer. It saw that the collars were empty, and from my log it knew what had grown in each of them. It suggested covering the soil with mulch or a sack, so the autumn rain doesn't wash the nutrients away before spring. I hadn't thought of that.

![A muddy thumbs up](https://raw.githubusercontent.com/zarasyversen/Toado/main/docs/images/muddy-thumbs-up.jpg)

## My Agent Session

I built Toado together with Claude Code, working from a written plan step by step: weather and climate first, then the rules, then Gemma, then the app itself. I reviewed and tried out each step before moving on. Plenty changed on the way:

- **The first idea was too narrow.** It started out mostly about frost dates. That didn't fit a garden like ours, so it became a year-round helper built around my own plants, the season and the weather.
- **Varieties got added** when I realised my two apple trees ripen weeks apart.
- **Gemma needed some help.** At first it said tonight would be 3 °C when the forecast low was −2 °C, so now the prompt states tonight's low directly. It also called a gooseberry a flower.
- **A code review caught real bugs.** One was that editing one plant changed the care for every plant of that kind.
- **Testing it myself helped most.** I got stuck in the demo garden with no way back, so that got fixed. When I found out Gemma could read images, I added photo questions. Opening it on my phone showed that Ollama was turning away requests from the Tailscale address.
- **The look is mine.** The colours come from a palette I picked.

## Prize Categories

- **Best Use of Gemma**: Gemma 4 runs locally through Ollama. It plans the day's jobs, suggests care for plants and varieties, answers questions about the garden and looks at photos.
