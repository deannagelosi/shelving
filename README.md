# todo

## Demo (Next Wednesday)

- anneal -> automata
  - multiple anneal passes instead of changing the temperature
  - merge dots into lines
- gravity: flat bottom
- build perimeter for case
- end when there are no more 8s (or no two rows/columns of 8s touching)
- detect joints

## Stretch

- input new shapes
- input -> anneal -> automaton -> export

- export to svgs

- hard code -> more flexible
  - change min white space minesweeper number to ratio
  - change overlap penalty to ratio (greater than adding enough white space to fix it)

- center of mass: another scoring mechanism

## Unusual Cases

- support small library of alternative perimeters
- support user supplied custom perimeters
- score penalty when out of bounds

## Alternative Workflows

- freeze shapes in layout
- stop button: good initial state, or stuck
- re-anneal button
- add option for empty spaces to fill later
- hang on wall (center of gravity is ignored) vs flat on table (requires flat bottoms)
