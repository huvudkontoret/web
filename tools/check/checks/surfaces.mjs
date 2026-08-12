/**
 * index.html, index.md and llms.txt say the same things to three different
 * audiences. They drift apart silently, and a stale llms.txt is not a cosmetic
 * problem: it is a wrong answer given confidently by somebody else's agent.
 *
 * Only mechanical facts are asserted — declared in facts.json, so the rules
 * are visible and editable without reading this file. Tone and wording are
 * deliberately not the gate's business.
 */

export const name = "surfaces";
export const summary = "index.html, index.md and llms.txt agree on the facts";

export function run(site, facts, report) {
  const surfaces = facts.surfaces
    .map((file) => ({ file, text: site.read(file) }))
    .filter((surface) => {
      if (surface.text === null) report.fail(surface.file, "missing — declared as an agent surface in facts.json");
      return surface.text !== null;
    });

  checkSharedFacts(surfaces, facts, report);
  checkAddressesNotInService(surfaces, facts, report);
  checkDuplicateSections(surfaces, report);
}

/**
 * A section heading appearing twice in the same surface.
 *
 * This is what a clean git merge looks like when two branches each add the
 * same section: no conflict, both kept. It reads as an ordinary file and
 * states the same thing twice to every agent that parses it.
 */
function checkDuplicateSections(surfaces, report) {
  for (const surface of surfaces) {
    if (surface.file.endsWith(".html")) continue;
    const seen = new Map();

    surface.text.split(/\r?\n/).forEach((line, index) => {
      const heading = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
      if (!heading) return;
      const key = `${heading[1]} ${heading[2].toLowerCase()}`;
      if (seen.has(key)) {
        report.fail(
          `${surface.file}:${index + 1}`,
          `"${heading[2]}" is already a section at line ${seen.get(key)} — ` +
            "duplicated headings are what a merge that kept both sides looks like",
        );
        return;
      }
      seen.set(key, index + 1);
    });
  }
}

/**
 * A fact stated on one surface must be stated on all of them. Facts absent
 * everywhere are not the gate's concern — that is an editorial decision, not
 * drift.
 */
function checkSharedFacts(surfaces, facts, report) {
  for (const fact of facts.sharedFacts) {
    const present = surfaces.filter((surface) => surface.text.includes(fact.match));
    if (present.length === 0 || present.length === surfaces.length) continue;

    const missing = surfaces.filter((surface) => !surface.text.includes(fact.match));
    report.fail(
      missing.map((surface) => surface.file).join(", "),
      `${fact.label} appears in ${present.map((surface) => surface.file).join(", ")} but not here — the agent surfaces disagree`,
    );
  }
}

/**
 * An address that is announced but not yet running must never read as live.
 * The rule is conditional: a surface that does not describe the address system
 * has nothing to get wrong.
 */
function checkAddressesNotInService(surfaces, facts, report) {
  for (const surface of surfaces) {
    const lines = surface.text.split(/\r?\n/);

    for (const address of facts.addressesNotInService) {
      // Matched with a boundary so ".ai" does not fire on "huvudkontoret.ai/x"
      // inside an unrelated word, and escaped because the token starts with a dot.
      const token = new RegExp(`${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9-])`, "i");

      lines.forEach((line, index) => {
        if (!token.test(line)) return;
        // Lines that list several addresses at once carry the caveat as a group.
        const marked = facts.inServiceMarkers.some((marker) => line.toLowerCase().includes(marker.toLowerCase()));
        if (marked) return;
        report.fail(
          `${surface.file}:${index + 1}`,
          `"${address}" is announced but not in service, and this line does not say so — ` +
            `add one of: ${facts.inServiceMarkers.join(", ")}`,
        );
      });
    }
  }
}
