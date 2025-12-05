# Comparison Tests - Multi-Language Examples

These test cases validate the language-agnostic hint system across HTML, CSS, JavaScript, and Python.

## HTML: Change Element Text

```json
{
  "language": "HTML",
  "userId": "test_html_001",
  "description": "HTML elements have opening tags like `<h1>` and closing tags like `</h1>`. The text an element will display goes between its opening and closing tags.\n\nChange the text of the `h1` element below from `Hello World` to `CatPhotoApp` and watch the change in the browser preview.",
  "userInput": "<h1>Hello World</h1>",
  "seed": "",
  "hints": [
    {"text": "The text `CatPhotoApp` should be present in the code."},
    {"text": "Your `h1` element should have an opening tag."},
    {"text": "Your `h1` element's text should be `CatPhotoApp`. You have either omitted the text, have a typo, or it is not between the `h1` element's opening and closing tags.", "failed": true}
  ]
}
```

## HTML: Add New Element

```json
{
  "language": "HTML",
  "userId": "test_html_002",
  "description": "The `h2` element is used for subheadings. Below the `h1` element, add an `h2` element with this text: `Cat Photos`",
  "userInput": "<h1>CatPhotoApp</h1>",
  "seed": "",
  "hints": [
    {"text": "Your `h2` element should have an opening tag.", "failed": true},
    {"text": "Your `h2` element should have a closing tag."},
    {"text": "Your `h2` element's text should be `Cat Photos`."}
  ]
}
```

## CSS: Add Style Property

```json
{
  "language": "CSS",
  "userId": "test_css_001",
  "description": "The `color` property in CSS sets the text color of an element. Add a `color` property to the `.title` class and set it to `blue`.",
  "userInput": ".title {\n  font-size: 24px;\n}",
  "seed": ".title {\n  font-size: 24px;\n}",
  "hints": [
    {"text": "Your `.title` class should have a `color` property.", "failed": true},
    {"text": "The `color` property should be set to `blue`."},
    {"text": "The property should be inside the `.title` class definition."}
  ]
}
```

## CSS: Fix Property Value

```json
{
  "language": "CSS",
  "userId": "test_css_002",
  "description": "Margin controls the space outside an element. Set the `margin` property of the `.box` class to `10px` on all sides.",
  "userInput": ".box {\n  margin: 20px;\n}",
  "seed": "",
  "hints": [
    {"text": "The `.box` class should have a `margin` property.", "failed": true},
    {"text": "The `margin` value should be `10px`, not `20px`."}
  ]
}
```

## JavaScript: Missing Variable Declaration

```json
{
  "language": "JavaScript",
  "userId": "test_js_001",
  "description": "Declare a variable named `count` using `const` and assign it the value `5`. Then log the variable to the console.",
  "userInput": "console.log(count);",
  "seed": "",
  "hints": [
    {"text": "You should declare a variable named `count`.", "failed": true},
    {"text": "The variable should be declared with `const`."},
    {"text": "The variable should be assigned the value `5`."}
  ]
}
```

## JavaScript: Incorrect Function Syntax

```json
{
  "language": "JavaScript",
  "userId": "test_js_002",
  "description": "Write an arrow function named `add` that takes two parameters `a` and `b` and returns their sum. Then call the function with arguments `3` and `4`.",
  "userInput": "const add = (a, b) => a + b;\nconsole.log(add(3));",
  "seed": "",
  "hints": [
    {"text": "The function should be called with two arguments.", "failed": true},
    {"text": "Both parameters `a` and `b` should be passed when calling the function."},
    {"text": "The function call should use `add(3, 4)`."}
  ]
}
```

## Python: Missing Import Statement

```json
{
  "language": "Python",
  "userId": "test_py_001",
  "description": "Import the `random` module at the top of your file. Then use `random.randint(1, 10)` to generate a random number between 1 and 10.",
  "userInput": "num = random.randint(1, 10)\nprint(num)",
  "seed": "",
  "hints": [
    {"text": "You should import the `random` module.", "failed": true},
    {"text": "The import statement should be at the top of the file."},
    {"text": "Use `import random` to import the module."}
  ]
}
```

## Python: Incorrect Indentation

```json
{
  "language": "Python",
  "userId": "test_py_002",
  "description": "Write a function named `greet` that takes a `name` parameter and returns a greeting string in the format `Hello, {name}!`. The function body should be properly indented.",
  "userInput": "def greet(name):\nreturn f'Hello, {name}!'",
  "seed": "",
  "hints": [
    {"text": "The function body should be indented.", "failed": true},
    {"text": "Python requires the `return` statement to be indented inside the function."},
    {"text": "Make sure the indentation is consistent (typically 4 spaces or 1 tab)."}
  ]
}
```
