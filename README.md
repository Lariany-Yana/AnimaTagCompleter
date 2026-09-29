# AnimaTagCompleter

[<img src="https://img.shields.io/badge/Язык-Русский-white.svg?style=flat-square" height="25" />](README.ru.md)

This extension adds booru-tag suggestions to ComfyUI for text entered in the input field.
The extension is designed primarily for the Anima model, but it can also be used for other models that understand booru tags.

<span style="display: flex; justify-content: center;">
<img src="https://files.catbox.moe/cgn1jh.webp" width="400" style="border-radius: 10px;" />
</span>

### Note

This extension was created as a replacement for [comfy-ex-tagcomplete](https://github.com/jupo-ai/comfy-ex-tagcomplete) for personal use with the Anima model. Bugs and errors are possible, and some functionality was deliberately not added due to personal lack of need.

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Lariany-Yana/AnimaTagCompleter.git
```

## Features

- Tag suggestion and insertion from CSV files
- Simultaneous search across multiple booru sources
- Tag search by categories
- Adding tags to favorites
- Adding custom categories and tags
- Searching artists from the ThetaCursed list

#### Bundled Data

- Danbooru (Data up to September 24 2026)
- Gelbooru (Data up to September 9 2025)
- Safebooru (Data up to August 6 2025)
- ThetaCursed (59,676 Danbooru Artist List)
- Custom (Own tags and categories)

For Anima 2b, Gelbooru tags work best. For Anima 2.9b and 3.8b - Danbooru tags.

## Highlights
- 2 tag display modes: "All matches" and "Highest score".<br>In the first case, all sources where the found tag is present are displayed.<br>In the second case, only the source with the highest score is displayed.

<span style="display: flex; justify-content: center;">
<img src="https://files.catbox.moe/aroixx.webp" width="800" style="border-radius: 3px;" />
</span>

###

- When entering a category, all tags from it are displayed after entering a space, without the need to type the first characters, and are sorted by score.
- When a tag is inserted, a space is automatically added before and after it.<br>If a separator is enabled, a space is added after it.<br>If a tag is inserted into brackets, spaces and the separator are added outside them.
- If a tag contains brackets, a backslash is automatically added before them.
- Found tags are shown primarily by match with the entered text, and secondarily by score.
- If the words in a tag are written in the wrong order, an "implied" tag with a higher score is offered in the results.

<span style="display: flex; justify-content: center;">
<img src="https://files.catbox.moe/jahycf.webp" width="400" style="border-radius: 3px;" />
</span>

###

- In order to know in advance which artist tag Anima is most likely to understand, the ThetaCursed source was added with a single category, Artist; a tag from this source is prioritized and will always be displayed first among other sources. If an artist tag lacks the ThetaCursed source, there is a chance that Anima does not know this tag.

<span style="display: flex; justify-content: center;">
<img src="https://files.catbox.moe/koag72.webp" width="400" style="border-radius: 3px;" />
</span>

###

- You can disable all tag sources (except Custom) or leave only the ones you need (for example, Danbooru and ThetaCursed).
- In the /tags/Custom folder you can create your own csv files (file name = category) with your own tags, for example, LoRA triggers, or templates for quickly sketching out a prompt.<br>It is assumed that the user will manually enter the trigger words they need, instead of using safetensors metadata, where there may be a wall of trigger words instead of one/two.
- The extension works in App Mode.

## Settings

<span style="display: flex; justify-content: center;">
<img src="https://files.catbox.moe/yc9rfp.webp" width="800" style="border-radius: 10px;" />
</span>

###

| Setting | Description |
| --- | --- |
| `Interface Language` | `English`/`Русский` Switches the language for the extension's settings interface.<br>Default `English`. |
| `Enable Extension` | `On`/`Off` Enables/Disables the extension.<br>Default `On` |
| `How to show favorite tags` | `Type --fav`/`Click on input` Choice of when favorite tags will be displayed.<br>Default `Type --fav` |
| `Show tags from the Deprecated category` | `On`/`Off` Determines whether tags from the Deprecated category will be shown (does not disable the category).<br>Default `On` |
| `Abbreviate score (K/M/B)` | `On`/`Off` Determines whether score values will be abbreviated. Abbreviates values to the first two digits (does not round).<br>Default `On` |
| `Minimum characters to trigger search` | `number` Determines how many characters need to be entered to start a tag search (does not affect category search).<br>Default `2` |
| `Maximum number of suggestions` | `number` Determines how many tags will be shown in the list at most.<br>Default `30` |
| `Separator` | `, (comma)`/`. (period)`/`None` Determines which separator will be inserted after a tag.<br>Default `, (comma)` |
| `Prefix before Artist category tags` | `text` Choice of the prefix that will be used for tags from the Artist category.<br>Default `@` |
| `Tag display mode` | `All matches`/`Highest score` Choice of how tags will be displayed in the list.<br>Default `All matches` |

| | |
| --- | --- |
| `Danbooru` | `On`/`Off` Determines whether this source will be used in the search.<br>Default `On` |
| `Gelbooru` | `On`/`Off` Determines whether this source will be used in the search.<br>Default `On` |
| `Safebooru` | `On`/`Off` Determines whether this source will be used in the search.<br>Default `Off` |
| `ThetaCursed` | `On`/`Off` Determines whether this source will be used in the search.<br>Default `On` |
| `Custom tags folder` | Opens the ./tags/Custom folder |