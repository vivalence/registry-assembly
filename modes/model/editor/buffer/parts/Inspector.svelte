<script>
  import { untrack } from "svelte";
  import { IDENTITY, at, fields, into as written, read, show, values } from "../form.js";

  let { scroll = 0, onscroll, card = null, count = 0, shapes = null, vocabulary = {}, siblings = [], draft = null, draftOf = null, move = { layer: "", parent: "" }, onstate, onsave, onmove, onretract } = $props();

  let fault = $state(null);
  let body = $state(null);
  let restored = false;

  const was = $derived(card ? values(card.ontology, card) : null);
  const held = $derived(card && draft && draftOf === card.slug ? draft : was);
  const schema = $derived(card && shapes ? shapes.VERBS[card.ontology] : null);
  const shown = $derived(schema ? fields(schema) : []);

  $effect(() => {
    if (restored || !body || !shown.length) return;
    restored = true;
    const offset = untrack(() => scroll);
    const settle = (tries) =>
      requestAnimationFrame(() => {
        if (!body) return;
        body.scrollTop = offset;
        if (Math.abs(body.scrollTop - offset) > 1 && tries) settle(tries - 1);
      });
    settle(30);
  });
  const moving = $derived({ layer: move.layer || card?.trait?.PLACED?.layer || "", parent: move.parent ?? "" });

  const example = (field) => (field.example ? `e.g. ${field.example.replace(/^"|"$/g, "")}` : "");

  const locked = (field) => card?.ontology === "placement" && IDENTITY.placement.includes(field.key) && field.key !== "ref";

  const draw = (next) => onstate({ draft: next, draftOf: card.slug }, true);

  const set = (field, text) => {
    try {
      draw(written(held, field.key, read(field.kind, text, field.length)));
      fault = null;
    } catch (error) {
      fault = `${field.key} · ${error.message}`;
    }
  };

  const toggle = (field) => draw(written(held, field.key, at(held, field.key) === true ? false : true));

  const choose = (field, option) => draw(written(held, field.key, at(held, field.key) === option ? null : option));

  const mark = (symbol) => {
    const carried = held.symbols ?? [];
    draw({ ...held, symbols: carried.includes(symbol) ? carried.filter((one) => one !== symbol) : [...carried, symbol] });
  };

  const save = () => {
    if (fault) return;
    onsave(card.ontology, held, was);
  };

  const trace = $derived(
    card
      ? `mode ${card.mode ?? "—"} · ${card.ontology === "placement" ? `path ${card.trait?.PLACED?.parent ? `${card.trait.PLACED.parent}/${card.trait.PLACED.name}` : card.trait?.PLACED?.name}` : (card.name ?? "")}`
      : "",
  );
</script>

<div class="head">
  <b>inspector</b>
  <span class="gap"></span>
  <span class="sub {card?.ontology ?? ''}">{card ? card.ontology : count > 1 ? `${count} selected` : ""}</span>
</div>

<div class="body" bind:this={body} onscrollend={() => onscroll?.(Math.round(body.scrollTop))}>
  {#if card && held}
    <div class="identity">
      <span class="slug">{card.slug}</span>
      <span class="trace">{trace}</span>
    </div>

    {#each shown as field (field.key)}
      <div class="field">
        <div class="label">
          <span class="key" class:locked={locked(field)}>{field.key}</span>
          <span class="gap"></span>
          <span class="group">{field.group ?? (field.required ? "identity" : "")}</span>
        </div>
        {#if field.kind === "lines"}
          <textarea rows="3" value={show(field.kind, at(held, field.key))} placeholder={example(field)} oninput={(event) => set(field, event.target.value)} onkeydown={(event) => event.key === "Enter" && (event.metaKey || event.ctrlKey) && save()}></textarea>
        {:else if field.kind === "flag"}
          <button class="flag" class:off={at(held, field.key) === false} onclick={() => toggle(field)}>{field.key} · {at(held, field.key) === false ? "false" : "true"}</button>
        {:else if field.kind === "enum"}
          <div class="options">
            {#each field.options as option}
              <button class="chip" class:on={at(held, field.key) === option} onclick={() => choose(field, option)}>{option}</button>
            {/each}
          </div>
        {:else}
          <input class:locked={locked(field)} readonly={locked(field)} value={show(field.kind, at(held, field.key))} placeholder={example(field)} oninput={(event) => set(field, event.target.value)} onkeydown={(event) => event.key === "Enter" && save()} />
        {/if}
        <span class="desc">{field.description}</span>
      </div>
    {/each}

    <div class="field">
      <div class="label"><span class="key">symbols</span></div>
      <div class="families">
        {#each Object.entries(vocabulary) as [family, symbols]}
          <div class="family">
            <span class="name">{family}</span>
            <div class="options">
              {#each symbols as symbol}
                <button class="chip" class:on={(held.symbols ?? []).includes(symbol)} onclick={() => mark(symbol)}>{symbol.slice(family.length + 1)}</button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if fault}<div class="fault">{fault}</div>{/if}

    <div class="acts">
      <button class="save" onclick={save}>save over · /{card.ontology}</button>
      <button class="retract" onclick={() => onretract(card.slug)}>retract</button>
    </div>

    {#if card.ontology === "placement"}
      <div class="panel">
        <div class="title">move · /move</div>
        <div class="note">its slug is its layer and its path — rename it from the tree</div>
        <div class="row">
          <input value={moving.layer} placeholder="layer" oninput={(event) => onstate({ move: { ...moving, layer: event.target.value } }, true)} />
          <input value={moving.parent} placeholder="parent path" oninput={(event) => onstate({ move: { ...moving, parent: event.target.value } }, true)} />
        </div>
        <div class="row wrap">
          {#each siblings.slice(0, 3) as one (one.slug)}
            <button class="chip" onclick={() => onstate({ move: { ...moving, parent: one.path } })}>under {one.name}</button>
          {/each}
          <span class="gap"></span>
          <button class="go" onclick={() => onmove({ slug: card.slug, ...(moving.layer && { layer: moving.layer }), parent: moving.parent })}>move</button>
        </div>
      </div>
    {/if}
  {:else if count > 1}
    <div class="empty">
      <span class="title">{count} selected</span>
      <span class="note">the inspector shows exactly one literal.<br />the stage and the tree hold the rest.</span>
    </div>
  {:else}
    <div class="empty">
      <span class="pulse"></span>
      <span class="title">nothing selected</span>
      <span class="note">a subject appears when a human<br />or a tool says a slug.</span>
    </div>
  {/if}
</div>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 9px;
    overflow: auto;
    padding: 10px 11px 14px;
    min-height: 0;
  }
  .identity {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--line);
  }
  .slug {
    font-size: 13px;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
  .trace {
    font-size: 10px;
    color: var(--mute);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .label {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .key {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .key.locked {
    color: var(--placement);
  }
  .group {
    font-size: 9px;
    color: var(--faint);
    text-transform: uppercase;
  }
  input,
  textarea,
  select {
    width: 100%;
    padding: 4px 7px;
    background: var(--field);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--ink);
    font: inherit;
    font-size: 11px;
    outline: none;
  }
  textarea {
    line-height: 1.6;
    resize: vertical;
  }
  input:focus,
  textarea:focus,
  select:focus {
    background: var(--pick);
    border-color: var(--pick-edge);
  }
  input.locked {
    background: var(--panel);
    border-color: var(--hair);
    color: var(--dim);
  }
  .desc {
    font-size: 9px;
    line-height: 1.5;
    color: var(--faint);
  }
  .options {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .chip {
    padding: 3px 8px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--dim);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .chip.on {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .families {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .family {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .family .name {
    font-size: 9px;
    color: var(--faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .flag {
    align-self: flex-start;
    padding: 3px 10px;
    background: transparent;
    border: 1px solid var(--good);
    border-radius: var(--radius);
    color: var(--good);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .flag.off {
    background: var(--warn-bg);
    border-color: var(--fail);
    color: var(--warn-ink);
  }
  .acts {
    position: sticky;
    bottom: -14px;
    z-index: 1;
    display: flex;
    gap: 5px;
    margin: 0 -11px -14px;
    padding: 8px 11px 10px;
    background: var(--panel);
    border-top: 1px solid var(--line);
  }
  .save {
    flex: 1;
    padding: 5px 0;
    background: transparent;
    border: 1px solid var(--part);
    border-radius: var(--radius);
    color: var(--part);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .retract {
    padding: 5px 11px;
    background: transparent;
    border: 1px solid var(--fail);
    border-radius: var(--radius);
    color: var(--fail);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: var(--recess);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
  }
  .panel .title {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--placement);
  }
  .panel .note {
    font-size: 9px;
    line-height: 1.5;
    color: var(--faint);
  }
  .panel .row {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .panel .row.wrap {
    flex-wrap: wrap;
  }
  .gap {
    flex: 1;
  }
  .go {
    padding: 3px 10px;
    background: transparent;
    border: 1px solid var(--placement);
    border-radius: var(--radius);
    color: var(--placement);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .fault {
    font-size: 10px;
    line-height: 1.5;
    color: var(--fail);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 34px 12px;
    text-align: center;
  }
  .empty .title {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .empty .note {
    font-size: 10px;
    line-height: 1.6;
    color: var(--faint);
  }
  .pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--faint);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(0.8);
    }
    50% {
      opacity: 0.7;
      transform: scale(1);
    }
  }
</style>
