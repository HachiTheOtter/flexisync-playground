const Realm = require("realm");
const clear = require("clear");
const inquirer = require("inquirer");
const index = require("./index");
const main = require("./main");
const output = require("./output");
const config = require("./config");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
 

function getSavedSubscriptions() {
  const appId = config.getValue("appId")
  let appParams = config.getValue(appId);

  if (appParams == undefined) {
    appParams = { subscriptions: {} };
    config.setValue(appId, appParams);
  }

  return appParams.subscriptions;
}

function getSubscriptions(realm) {
  if (!realm.subscriptions.isEmpty) {
    let subscriptions = [];

    realm.subscriptions.forEach((value, index, subscriptionSet) => subscriptions.push({ Name: value.name, Table: value.objectType, Query: value.queryString }));

    return subscriptions;
  } else {
    return [];
  }
}

async function clearSubscriptions(realm) {
  if (!realm.subscriptions.isEmpty) {
    await realm.subscriptions.update((mutableSubs) => {
      mutableSubs.removeAll();
    });
  }
}

async function listSubscriptions() {
  const subscriptions = getSubscriptions(await index.getRealm());

  output.table(subscriptions);

  await main.waitForKey();
}

async function applyInitialSubscriptions(realm) {
  if (realm.subscriptions.isEmpty) {
    const subscriptions = getSavedSubscriptions();
    const keys = Object.keys(subscriptions);

    if (keys.length > 0) {
      let cursors = {};

      keys.forEach(element => {
        let className = subscriptions[element]["class"];

        cursors[className] = realm.objects(className);
      });

      await realm.subscriptions.update((mutableSubs) => {
        keys.forEach(element => {
          let className = subscriptions[element]["class"];
          let objects = cursors[className];

          mutableSubs.add(objects.filtered(subscriptions[element]["filter"]), { name: element });
        });
      });
    }
  }

  await realm.subscriptions.waitForSynchronization();
}

async function addModifySubscription() {
  const realm = await index.getRealm()

  const input = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Please enter the subscription name:",
    },
    {
      type: "input",
      name: "collection",
      message: "Collection/Table Name:",
    },
    {
      type: "input",
      name: "query",
      message: "RQL Filter:",
    },
  ]);

  // Do nothing if parameters aren't long enough
  if ((input.name.length < 2) || (input.collection.length < 2) || (input.query.length < 2)) { return; }

  try {
    const objects = realm.objects(input.collection);

    if (objects) {
      const spinner = index.spinner;

      spinner.text = `Adding/Modifying subscription ${input.name}…`;
      spinner.start();

      await realm.subscriptions.update((mutableSubs) => {
        mutableSubs.add(objects.filtered(input.query), { name: input.name });
      });

      spinner.text = "Refreshing subscriptions…";
      await realm.subscriptions.waitForSynchronization();

      const appId = config.getValue("appId")
      let appParams = config.getValue(appId);

      appParams.subscriptions[input.name] = { class: input.collection, filter: input.query };

      config.setValue(appId, appParams);

      spinner.succeed("Subscriptions refreshed!");
    } else {
      output.error(`Class ${input.class} doesn't exist!`);
    }
  } catch (err) {
    output.error(err.message);
  }
      
  await sleep(2000);
}

async function removeSubscription() {
  const realm = await index.getRealm()
  const subscriptions = getSubscriptions(realm);

  clear();

  output.table(subscriptions);

  let names = subscriptions.map((value) => value.Name);

  let choice = await inquirer.prompt([
    {
      type: "rawlist",
      name: "remove",
      message: "Which subscription do you want to remove?",
      choices: [...names, new inquirer.Separator(), "Back"],
    },
  ]);

  switch (choice.remove) {
    case 'Back':
      return;
    default: {
      const spinner = index.spinner;

      spinner.text = `Removing subscription ${choice.remove}…`;
      spinner.start();

      await realm.subscriptions.update((mutableSubs) => {
        mutableSubs.removeByName(choice.remove);
      });

      spinner.text = "Refreshing subscriptions…";
      await realm.subscriptions.waitForSynchronization();

      const appId = config.getValue("appId")
      let appParams = config.getValue(appId);

      delete appParams.subscriptions[choice.remove];

      config.setValue(appId, appParams);

      spinner.succeed("Subscriptions refreshed!");
      
      await sleep(2000);
    }
  }
}

async function refreshSubscriptions() {
  const realm = await index.getRealm();

  if (realm) {
    const spinner = index.spinner;

    spinner.text = "Clearing subscriptions…";
    spinner.start();
    await clearSubscriptions(realm);
    spinner.text = "Applying subscriptions…";
    await applyInitialSubscriptions(realm);

    spinner.succeed("Subscriptions refreshed!");
      
    await sleep(2000);
  }
}

exports.listSubscriptions = listSubscriptions;
exports.applyInitialSubscriptions = applyInitialSubscriptions;
exports.addModifySubscription = addModifySubscription;
exports.removeSubscription = removeSubscription;
exports.refreshSubscriptions = refreshSubscriptions;
