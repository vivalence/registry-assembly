import { v, Vector } from "@vivalence/typology";
import { VERBS } from "../schematics.js";
import { through } from "./mint.js";

// the layer editors as tools: parts placed under a layer, placements moved, a guide's steps sequenced
export const layer = new Vector()
  .open(
    {
      nature: "/placement",
      valence: 'Place a part under a part\'s layer. One occurrence: its name among its siblings, what it places by ref, where, in metres, Y-up. The same layer, parent and name again is an over carrying only what changes. A fastener says what it joins; the kind of joint is a joint.* symbol; how far it is done up is a step\'s note. Example: { layer: "frame", name: "arm.0", ref: "arm", translation: [-0.0887, 0.0021, 0.0823] }',
      input: v.object(VERBS.placement),
    },
    through("/placement"),
  )
  .open(
    {
      nature: "/move",
      valence: 'Move a placement — to another part\'s layer, under another parent (its path in that layer; "" for the root), or to another name. Its slug follows; the placements under it go with it; joins naming its path and steps naming its slug are rewritten. Read the tree first: work with real paths. Example: { slug: "frame.arm.0", layer: "chassis" }',
      input: v.object(VERBS.move),
    },
    through("/move"),
  )
  .open(
    {
      nature: "/sequence",
      valence: 'Set a guide\'s sections, whole — its steps in order under their headings. Every step must already exist, once. Example: { guide: "drone", sections: [{ name: "Frame", steps: ["drone.01", "drone.02"] }] }',
      input: v.object(VERBS.sequence),
    },
    through("/sequence"),
  );
