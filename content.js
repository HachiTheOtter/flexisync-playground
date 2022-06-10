const Realm = require("realm");
const inquirer = require("inquirer");
const index = require("./index");
const config = require("./config");
const output = require("./output");

function queryClasses(realm) {
  const realm_schema = realm.schema;

  var classes = [];

  for (const objSchema of realm_schema.sort((a, b) => a['name'] < b['name'])) {
    classes.push(objSchema);
  }

  return classes;
}

function trackClass(realm, className) {
  let objects = realm.objects(className);

  output.watchResult(`${className}`, `${objects.length} objects`);
}

async function showContent() {
  let realm = await index.getRealm();

  if (realm == undefined) { return; }

  let synchedClasses = queryClasses(realm);

  for (const objSchema of synchedClasses) {
    if (!objSchema['embedded']) {
      trackClass(realm, objSchema['name']);
    }
  }

  const input = await inquirer.prompt([
    {
      type: "input",
      name: "dummy",
      message: "Press a key to proceed…",
    }
  ]);
}

exports.showContent = showContent;