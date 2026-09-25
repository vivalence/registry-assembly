import { Vector } from "@vivalence/typology";
import { mint } from "./mint.js";
import { layer } from "./layer.js";
import { fold } from "./fold.js";

// the tools every assembly mode's agent shares, armed as assembly_*: mint literals, edit layers
// and guides, read the fold. each calls its verb through daemon.call; the subject is the slug in the input.
export const tools = new Vector().graft(mint).graft(layer).graft(fold);
