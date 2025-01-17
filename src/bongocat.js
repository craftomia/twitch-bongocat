import {parseSong as parseSongBongo} from "./modules/bongo.js";

// ====================================================== //
// ================== type definitions ================== //
// ====================================================== //

/**
 * Song typedefinition
 * @date 5/7/2023 - 2:00:19 PM
 * 
 * @typedef Song
 * @type {object}
 * @property {string} notes - the notes of the song
 * @property {string} notation - notation used for the song
 * @property {string} performer - the name of the one playing this song
 * @property {string} [author] - optional name of the author in case of saved song
 * @property {string} [title] - optional title of the song in case of a saved song
 * @property {string[]} [dedications] - optional dedications of the song
 */

/**
 * Playback typedefinition
 * @date 5/7/2023 - 2:00:19 PM
 * 
 * @typedef Playback
 * @type {object}
 * @property {object} cmd - the command to execute
 * @property {number} time - the time when it should be executed
 * @property {any[]} args - the arguments for the command
 */

// ====================================================== //
// ==================== global state ==================== //
// ====================================================== //
var maxBpm = 800;
var minBpm = 50;

var bpm = {};
bpm.user = {};
var queue = [];
var bongoEnabled = true;
var playing = false;
setBPM(128);
var githubUrl = "https://raw.githubusercontent.com/jvpeek/twitch-bongocat/master/songs/";
var stackMode = false;
var defaultNotation = "bongo";

var currentSong = null;
var volume = 1.0;

window.maxNotesPerBatch = 5;

// ====================================================== //
// ================== notation handlers ================= //
// ====================================================== //
var notations = {};

notations["bongol"] = parseSongBongo;
notations["legacy"] = parseSongBongo;
notations["bongo"] = parseSongBongo;
notations["bongo+"] = parseSongBongo;


// ====================================================== //
// =================== helper methods =================== //
// ====================================================== //
function setVolume(volumeParam)
{
  volume = Math.min(1.0, Math.max(0, Number(volumeParam)));
}

function setBPM(targetBPM, username)
{
  targetBPM = Number(targetBPM);
  if (isNaN(targetBPM))
  {
    return;
  }
  if (targetBPM < minBpm)
  {
    targetBPM = minBpm;
  }
  if (targetBPM > maxBpm)
  {
    targetBPM = maxBpm;
  }
  if (username === undefined)
  {
    console.log("<Global> current BPM: " + bpm.global + ". Target: " + Math.floor(60000 / targetBPM));
    bpm.global = Math.floor(60000 / targetBPM);
  } else
  {
    console.log("<User> current BPM for " + username + ": " + bpm.user[username] + ". Target: " + Math.floor(60000 / targetBPM));
    bpm.user[username] = Math.floor(60000 / targetBPM);
  }
}

function getBPM(username)
{
  if (username === undefined || bpm.user[username] === undefined)
  {
    return bpm.global;
  } else
  {
    return bpm.user[username];
  }
}

function playSound(cmd, cBpm)
{
  const audio = document.querySelector(`audio[data-key="${cmd}"]`);
  if (!audio)
  {
    if (cmd != ".")
    {
      console.error("No audio for ", cmd);
    }
    return;
  }
  setPaw(audio.dataset.paw, cBpm);
  setInstrument(audio.dataset.instrument);

  audio.currentTime = 0;
  audio.volume = volume;
  audio.play();
}

function introAnimation(song)
{
  let username = song.performer;
  if (!song.author || song.performer == song.author)
  {
    document.getElementById("nametag").innerHTML = username + " entered the stage";
  }
  else
  {
    document.getElementById("nametag").innerHTML = username + " performs " + song.title + " by " + song.author;
  }

  if (song.dedications)
  {
    song.dedications = song.dedications.filter((dedication, index) =>
    {
      return song.dedications.indexOf(dedication) === index;
    });

    document.getElementById("dedications").innerHTML = "This song is dedicated to " + song.dedications.join(", ");
    document.getElementById("dedications").style.visibility = "visible";
  } else
  {
    document.getElementById("dedications").innerHTML = "";
    document.getElementById("dedications").style.visibility = "hidden";
  }

  document.getElementById("bongocat").style.left = "0px";
  playing = true;
}

function outroAnimation()
{
  document.getElementById("bongocat").style.left = "-1920px";
  setInstrument("none");
  setTimeout(function ()
  {
    playing = false;
    currentSong = null;
  }, 1000);
}

function setInstrument(instrument)
{
  var c = document.getElementById("instruments").children;
  for (var i = 0; i < c.length; i++)
  {
    c[i].style.visibility = "hidden";
  }
  var newInstrument = document.getElementById(instrument);
  if (!newInstrument) {return;}
  newInstrument.style.visibility = "visible";

}

function setPaw(paw, cBpm)
{
  var currentPaw = document.getElementById(paw);
  currentPaw.style.backgroundPosition = "top right";
  window.setTimeout(releasePaw, cBpm / 2, paw);
}

function releasePaw(paw)
{

  var currentPaw = document.getElementById(paw);
  currentPaw.style.backgroundPosition = "top left";
}

function preparePlaybackObject(cmd, time, ...args)
{
  return {time: time, cmd: cmd, args: args};
}

var helperMethods = {setBPM, getBPM, playSound, introAnimation, outroAnimation, setInstrument, setPaw, releasePaw, preparePlaybackObject};
for (const key in helperMethods)
{
  window[key] = helperMethods[key];
}
window.helperMethods = helperMethods;
console.log(helperMethods);


// ====================================================== //
// ================== queue management ================== //
// ====================================================== //

/**
 * Adds a song to the queue
 * @date 5/7/2023 - 2:01:20 PM
 *
 * @param {Song} song
 */
function addToQueue(song)
{
  //pre check for valid song
  if (!song.notes)
  {
    return;
  }

  if (!song.notation)
  {
    song.notation = defaultNotation;
  }
  if (!song.performer)
  {
    song.performer = "anonymous";
  }

  queue.push(song);
}

/**
 * Returns the oldest song in the queue 
 * @returns {Song}
 */
function getFromQueue()
{

  var returnvalue;
  if (stackMode)
  {
    returnvalue = queue.pop();
  } else
  {
    returnvalue = queue.shift();
  }
  return returnvalue;
}

/**
 * Sets the interval for the checkQueue function
 * once per second
 * @date 5/7/2023 - 2:10:23 PM
 */
function startQueue()
{
  setInterval(checkQueue, 1000);
}


/**
 * Checks for new songs in the queue
 * In case of a new song and no currently playing song the next song is retrieved from the queue
 * This song is then parsed by the handler defined for the used notation
 * then its played back
 * @date 5/7/2023 - 2:10:56 PM
 */
function checkQueue()
{
  if (queue.length > 0 && playing == false)
  {
    var song = getFromQueue();
    let handler = notations[song.notation];
    if (handler)
    {
      currentSong = song;
      currentSong.timeoutIDs = [];
      introAnimation(song);
      let playbacks = handler(song);
      console.log(playbacks);
      for (let playback of playbacks)
      {
        currentSong.timeoutIDs.push(setTimeout(playback.cmd, playback.time, ...playback.args));
      }
    }
    //addNotes(noteString, isLegacyNotation, username);
  }
}


// ====================================================== //
// ===================== remote play ==================== //
// ====================================================== //
async function playFromGithub(song, user)
{
  const userRegex = /@\w+/g;
  let dedications = song.match(userRegex)?.map(s => s.replace("@", ""));
  song = song.replaceAll(userRegex, ""); //remove usernames from string
  song = song.trim().replaceAll(/\s+/g, "_").replace(/\.json$/, "").replaceAll(".", ""); //remove whitespaces, remove dots

  song += ".json";

  console.log("Playing", song, "from github for", user);
  const response = await fetch(encodeURI(githubUrl + song.trim()));
  if (response.status != 200)
  {
    return;
  }
  //console.log(response)
  const jsonData = await response.json();
  console.log(jsonData);
  jsonData.performer = user;
  jsonData.dedications = dedications;
  addToQueue(jsonData);
}



// ====================================================== //
// ==================== mod commands; =================== //
// ====================================================== //
const commands = {};

function enableBongo(args)
{
  if (isSuperUser(args.tags))
  {
    console.log("aktiviere Bongo");
    bongoEnabled = true;
  }
}
commands["!enablebongo"] = enableBongo;

function disableBongo(args)
{
  if (isSuperUser(args.tags))
  {
    console.log("deaktiviere Bongo");
    bongoEnabled = false;
  }
}
commands["!disablebongo"] = disableBongo;

function clearQueue(args)
{
  if (isSuperUser(args.tags))
  {
    queue = [];
  }
}

commands["!bongoclear"] = clearQueue;

function skipSong(args)
{
  if (!isSuperUser(args.tags))
  {
    return;
  }
  if (!currentSong)
  {
    return;
  }

  if (!currentSong.timeoutIDs)
  {
    return;
  }

  console.log(`${args.tags.username} cleared the current song ${currentSong}`);

  for (let id of currentSong.timeoutIDs)
  {
    clearTimeout(id);
  }

  outroAnimation();
}

commands["!bongoskip"] = skipSong;

function setVolumeCommand(args)
{
  if (!isSuperUser(args.tags))
  {
    return;
  }
  setVolume(args.arg);
}

commands["!bongovolume"] = setVolumeCommand;

// ====================================================== //
// ==================== user commands =================== //
// ====================================================== //

function bongoDefault(args)
{
  if (!bongoEnabled)
  {
    return;
  }
  //const notes = args.message.substr(8);
  console.log(args);
  const notes = args.arg;
  console.log(`${args.tags.username} plays ${notes}. with ${defaultNotation}`);
  let song = {performer: args.tags.username, notes: notes, notation: defaultNotation};
  addToQueue(song);
}

function bongoPlus(args)
{
  if (!bongoEnabled)
  {
    return;
  }
  //const notes = args.message.substr(8);
  console.log(args);
  const notes = args.arg;
  console.log(`${args.tags.username} plays+ ${notes}.`);
  let song = {performer: args.tags.username, notes: notes, notation: "bongo"};
  addToQueue(song);
}
commands["!bongo"] = bongoDefault;
commands["!bongo+"] = bongoPlus;

function bongo(args)
{
  if (!bongoEnabled)
  {
    return;
  }
  //const notes = message.substr(7);
  const notes = args.arg;
  console.log(`${args.tags.username} plays ${notes}.`);
  let song = {performer: args.tags.username, notes: notes, notation: "legacy"};
  addToQueue(song);
}
commands["!bongol"] = bongo;

function changeBpm(args)
{
  if (!bongoEnabled)
  {
    return;
  }
  //const targetBPM = Number(message.substr(5));
  const targetBPM = Number(args.arg);
  //if (targetBPM <= 600 && targetBPM > 49)
  //{
  console.log(`${args.tags.username} set BPM to ${targetBPM}.`);
  setBPM(targetBPM, args.tags.username);
  //}
}
commands["!bpm"] = changeBpm;

function bongoPlay(args)
{
  if (!bongoEnabled)
  {
    return;
  }

  playFromGithub(args.arg, args.tags.username);

}
commands["!bongoplay"] = bongoPlay;

function handleCommand(message, command, arg, tags)
{

  let msg = message.toLowerCase();
  let longestCmd = "";
  for (let cmd in commands)
  {
    if (msg.startsWith(cmd))
    {
      if (cmd.length > longestCmd.length)
      {
        console.log(cmd, "beat", longestCmd);
        longestCmd = cmd;
      }
    }
  }
  if (longestCmd)
  {
    commands[longestCmd]?.({message: message, command: command, arg: arg, tags: tags});
  }
  /*
  let handler = commands[command]
  if(handler) {
    handler(arg, tags)
  }
  */
}


// ====================================================== //
// ======================= config ======================= //
// ====================================================== //
let params = new URLSearchParams(document.location.search);

let maxNotesPerBatch = params.get("maxNotesPerBatch");
if (maxNotesPerBatch && Number(maxNotesPerBatch))
{
  window.maxNotesPerBatch = Number(maxNotesPerBatch);
}
let maxPbmParam = params.get("maxBpm");
if (maxPbmParam && Number(maxPbmParam))
{
  maxBpm = Number(maxPbmParam);
}
let minPbmParam = params.get("minBpm");
if (minPbmParam && Number(minPbmParam))
{
  minBpm = Number(minPbmParam);
}

if (params.get("stackMode"))
{
  stackMode = true;
}

let volumeParam = params.get("volume");
if (volumeParam && !isNaN(Number(volumeParam)))
{
  setVolume(volumeParam);
}

// ====================================================== //
// ======================== tmijs ======================= //
// ====================================================== //
const channel = location.hash || params.get("channel") || 'jvpeek';
const chatClient = new tmi.Client({
  channels: [channel]
});
chatClient.connect();

chatClient.on('connected', (address, port) =>
{
  console.log(`Connected to ${address}:${port}, channel ${channel}.`);
});
function isSuperUser(tags)
{
  return tags.mod || tags.badges?.broadcaster || tags.username == "jvpeek";
}
chatClient.on('message', (channel, tags, message, self) =>
{

  if (message.startsWith("!"))
  {
    let args = message.split(/\s+/);
    let cmd = args[0];
    args = args.splice(1);
    let arg = args.join(" ");
    console.log(cmd, arg);
    handleCommand(message, cmd, arg, tags);
  }
});

startQueue();
