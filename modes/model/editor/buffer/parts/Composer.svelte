<script>
  import { tick } from "svelte";

  let { compose = "", turns = [], turn = null, hint = "", prefills = [], onchange, onsend, onturn, onfill, register } = $props();

  let field = $state(null);

  const shown = $derived(turn != null && turn < turns.length ? turns[turn] : null);
  const at = $derived(turn ?? turns.length);

  $effect(() => {
    register?.(() => {
      onturn(null);
      tick().then(() => field?.focus());
    });
  });

  const keyed = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    onsend();
  };
</script>

<div class="column">
  {#if shown}
    <div class="message {shown.who}" class:refused={shown.state === "refused"}>
      <span class="text">{shown.text}</span>
    </div>
  {:else}
    <textarea bind:this={field} value={compose} placeholder={hint} oninput={(event) => onchange(event.target.value)} onkeydown={keyed}></textarea>
  {/if}
  <div class="bar">
    {#if !shown}
      {#each prefills as one (one.label)}
        <button class="fill" onclick={() => onfill(one.text)}>{one.label}</button>
      {/each}
    {/if}
    <span class="gap"></span>
    {#if !shown}
      <span class="keys">⏎ send · ⇧⏎ line</span>
      <button class="send" onclick={onsend}>send</button>
    {/if}
    <span class="rule"></span>
    <span class="state {shown?.state ?? ''}">{shown?.state ?? ""}</span>
    <span class="index">{Math.min(at, turns.length) + 1} / {turns.length + 1}</span>
    <button class="walk" class:live={at > 0} onclick={() => onturn(Math.max(0, at - 1))}>◀</button>
    <button class="walk" class:live={at < turns.length} onclick={() => onturn(at + 1 >= turns.length ? null : at + 1)}>▶</button>
  </div>
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 12px 11px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .message {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 7px 9px;
    background: var(--recess);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
  }
  .text {
    font-size: 11px;
    line-height: 1.75;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .message.refused .text {
    color: var(--warn-ink);
  }
  textarea {
    flex: 1;
    min-height: 42px;
    width: 100%;
    padding: 7px 9px;
    background: var(--recess);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    color: var(--ink);
    font: inherit;
    font-size: 11px;
    line-height: 1.75;
    outline: none;
    resize: none;
  }
  textarea:focus {
    background: var(--pick);
    border-color: var(--pick-edge);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .gap {
    flex: 1;
  }
  .fill {
    padding: 2px 7px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--placement);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    white-space: nowrap;
    cursor: pointer;
  }
  .keys,
  .index {
    font-size: 9px;
    color: var(--faint);
    white-space: nowrap;
  }
  .send {
    padding: 2px 10px;
    background: transparent;
    border: 1px solid var(--part);
    border-radius: var(--radius);
    color: var(--part);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .rule {
    width: 1px;
    height: 12px;
    margin: 0 3px;
    background: var(--line);
  }
  .state {
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
    white-space: nowrap;
  }
  .state.replied {
    color: var(--good);
  }
  .state.refused {
    color: var(--fail);
  }
  .walk {
    padding: 1px 6px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--edge);
    font: inherit;
    font-size: 9px;
    cursor: pointer;
  }
  .walk.live {
    color: var(--dim);
  }
</style>
