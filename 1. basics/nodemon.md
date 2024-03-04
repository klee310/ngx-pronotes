nodemon monitors files within the specified folder and restarts the given process if changes are detected.

to provide persistant blacklist (ignore) configuration, create a file called "nodemon.json" for the following content (example)

<code>
{
  "ignore": ["*.json", "*.test.js"]
}
</code>