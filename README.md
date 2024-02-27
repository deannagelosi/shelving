# Notes

## Improvements

- next button
  - greyed out until 10 shapes are added
  - moves to input UI to case UI
- t-joints cut twice
- paint for shape import in p5
- make README and GitHub repo

## Laser Cut Adjustments

- adjust for kerf (different for vertical and horizontal)
- prep for print bed
  - all rect are oriented the same direction
  - pack all rectangles efficiently

## Stretch Goals

- add points of interest (e.g., labels)
  - every horiz board needs a letter (sort top -> bottom)
  - every vert board needs a number (sort left -> right)
  - label their connection on the board (alpha-numeric)
  - label the horiz board with shape name
- move and board methods (like allowGrowth) from Case into Board and Shape
- packing algorithm for svg layout
- improvements to the UI
  - save button to export Shape data into JSON
  - instructions card
  - save button for SVG output
  - regenerate button for the new case
- drag to paint input in p5
- support bowls (i.e., boundary dipping inside a form)
- say "generating" on the screen instead of just "build issue" in console.log
- detect cross joints and apply a c-slot joint
- trace letters in code
- letters and squares on own layer
- square move to top right corner
- bad art
  - throw away any layouts with vertical boards full height except for edges
  - double bar
  - missing boards
