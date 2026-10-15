# Numerical Analysis Workbench

An interactive companion site for the Numerical Analysis course (Zarqa
University). Every method from the slides — Chapters 1 through 7 — is here
as a calculator: enter your own function, interval, or data, click
**Calculate**, and see every iteration step, not just the final answer.

## What's included

- **Chapter 1** — Absolute & Relative Error, Taylor Polynomial Approximation
- **Chapter 2** — Bisection, Fixed-Point Iteration, Newton's Method, Secant
  Method, Method of False Position
- **Chapter 3** — Lagrange Interpolation, Divided Differences, Natural Cubic
  Spline
- **Chapter 4** — Numerical Differentiation, Richardson's Extrapolation,
  Trapezoidal & Simpson's Rule (Composite), Gaussian Quadrature
- **Chapter 5** — Euler's Method, Runge–Kutta (RK4)
- **Chapter 6** — Gaussian Elimination (with optional partial pivoting)
- **Chapter 7** — Vector & Matrix Norms, Jacobi & Gauss–Seidel

## Files

```
index.html      the page
app.js          all calculator logic (one file, organized by chapter)
vendor/         KaTeX (math rendering) and math.js (expression parsing),
                bundled locally so the site works fully offline —
                no CDN, no internet connection required after download
```

## How to use it

**Just open it.** Double-click `index.html`, or drag it into a browser tab.
Nothing to install, no server required.

## How to share it with students

Any of these work, in order of simplicity:

1. **Share the whole folder** (zipped) — students unzip and open
   `index.html` directly. Works completely offline.
2. **GitHub Pages** — push this folder to a GitHub repo and enable Pages in
   the repo settings. Free, gives students a permanent link, updates
   whenever you push changes.
3. **Any static file host** (Netlify, Vercel, a university web server,
   Google Drive with a sharing link) — this is a plain static site, so
   anything that serves files works.

## Notes on the function input

Type functions using standard notation: `x^3 + 4*x^2 - 10`, `sin(x)`,
`exp(x)`, `sqrt(x)`, `log(x)`. For ODEs, use `t` and `y` as the two
variables, e.g. `y - t^2 + 1`.

## Extending it

Every tool is one object inside a `registerChapter(...)` call in `app.js`,
with a `build(container)` function that draws its inputs and wires up the
Calculate button. Copy an existing tool as a template for a new one — the
shared helpers (`makeF1`, `makeF2`, `stepsTable`, `plotFunction`,
`nodesEditor`, `systemEditor`) handle the common parts (expression
parsing, table rendering, plotting, and dynamic data/matrix entry).
