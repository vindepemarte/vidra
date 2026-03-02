---
description: How to create a new AI influencer persona or generate content using the LIFE framework
---

# LIFE Framework Workflow

This workflow covers using the LIFE framework either through the CLI or through chat.

## Chat Mode: Creating a New Persona

When the user says "create" or asks to create a new influencer:

1. Ask for the following details:
   - Full name
   - Age
   - Gender (female/male)
   - City they live in
   - Niche / career direction
   - Vibe (3 words describing their aesthetic)
   - Style inspirations (optional)
   - Higgsfield Soul ID (optional)
   - Instagram handle (optional)

2. Run the creation pipeline:
// turbo
```bash
cd /home/alex/Documents/Projects-AGravity/life-framework && python -c "
from life.core.persona import create_from_dict, generate_persona
persona = create_from_dict({
    'name': '<NAME>',
    'handle': '<HANDLE>',
    'age': <AGE>,
    'gender': '<GENDER>',
    'city': '<CITY>',
    'niche': '<NICHE>',
    'vibe': '<VIBE>',
    'soul_id': '<SOUL_ID>',
    'instagram_handle': '<IG_HANDLE>'
})
generate_persona(persona)
"
```

3. Review the generated files in `personas/<slug>/` and present a summary to the user.

## Chat Mode: Generating a Content Calendar

When the user says "calendar", "generate", or asks for content:

1. List existing personas:
// turbo
```bash
cd /home/alex/Documents/Projects-AGravity/life-framework && python -c "
from life.core.persona import list_personas
for p in list_personas():
    print(f'{p[\"name\"]} — {p[\"city\"]} — {p[\"niche\"]}')
"
```

2. Ask which persona and which month/year.

3. Generate the calendar:
```bash
cd /home/alex/Documents/Projects-AGravity/life-framework && python -c "
from life.ai.llm import LLM
from life.core.calendar import generate_month_calendar
try:
    from life.ai.search import BraveSearch
    search = BraveSearch()
except:
    search = None
llm = LLM()
generate_month_calendar(llm, search, 'personas/<SLUG>', <MONTH>, <YEAR>)
"
```

4. Review the generated content in `personas/<slug>/calendar/<year>-<month>/`.

## CLI Mode

// turbo
```bash
cd /home/alex/Documents/Projects-AGravity/life-framework
life
```

This launches the interactive Rich CLI with menus for creating and managing personas.
