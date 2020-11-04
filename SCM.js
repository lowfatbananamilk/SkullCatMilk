require("./Tools")();

const prefixes = ['skullcat', 'sk', '~'];
//const prefixes = ['!'];

discordClient.on("ready", () => {
    discordClient.user.setActivity(`Check out 'sk help'  GLHF`, {type: "PLAYING"})
    console.log(`\nLogged in Discord as ${discordClient.user.tag}`);
    
    prefixes.push(`<@!${discordClient.user.id}> `);
});

discordClient.on("guildCreate", guild => {
    console.log (`Joined a new server: ${guild.name} with ${guild.memberCount} members.`);

    if (!servers[guild.id])
        servers[guild.id] = {
            "name": guild.name,
            "lang": "en",
            "allowTrack": true
        };  
    else
        delete servers[guild.id].deleted;

    const channel = guild.channels.cache.find(channel => channel.type == 'text' && channel.permissionsFor(guild.me).has('SEND_MESSAGES'));
    servers[guild.id].defaultChannel = (channel == -1) ? null : channel.id

    SaveFile("./servers.json", servers);

    if (channel != -1)
        channel.send("Thanks for inviting me!\nDefault language is set to English. Moderators can change this using `sk setting`.\nGLHF!");
});

discordClient.on("guildDelete", guild => {
    console.log(`left a server: ${guild.name}`);

    servers[guild.id].deleted = true;
    servers[guild.id].defaultChannel = null;

    SaveFile("./servers.json", servers);
});

discordClient.on("message", async message => {
    //*
    if((message.content.toLowerCase().includes("what is skull cat") || message.content.toLowerCase().includes("what is skullcat")) && message.author.id != discordClient.user.id) {
        const embed = {
            "description": "[Tweet by @FrostynoTen](https://twitter.com/FrostynoTen/status/1250988835485257728)"
          };
        await message.channel.send("They always ask, \"what is SkullCat?\"", {files: [{attachment: './@FrostynoTen.png', name: '@FrostynoTen.png'}]});
        message.channel.send("But never \"how is SkullCat?\"", { embed });

        return;
    }
    //*/

    for(const thisPrefix of prefixes) {
        if(!message.content.toLowerCase().startsWith(thisPrefix))
            continue;
        if(message.author.bot)
            return;

        var args = message.content.slice(thisPrefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        var messageInfo = {
            message: message,
            userLang: accounts[message.author.id] ? accounts[message.author.id].lang : null,
            serverLang: message.guild ? servers[message.guild.id].lang : "en"
        };

        if (command == "help" || command == "man" || command == "?") {
            var embed = Object.assign({}, text.defaultEmbed);
            embed.title = "Manual";
            embed.description = `Bot prefixes:\nsk, skullcat, ~, <@!${discordClient.user.id}>`
            embed.fields = [
                { "name": "sk quiz", "value": "> Starts a SAR Quiz Minigame. (Multiplayer)" },
                { "name": "sk profile [player] `or` sk profile", "value": "> Displays [player]'s or your SAR statistics." },
                { "name": "sk link [player]", "value": `> Links your steam account to <@!${discordClient.user.id}> which allows you to use:\n> •@Discord mention as [player] argument\n> •sk lang\n> •sk track` },
                { "name": "sk lang", "value": "> Change your language preference." },
                { "name": "sk track", "value": "> Displays match statistics after finishing a SAR match.\n> Keep your Discord Game Activity on!" },
                { "name": "sk ping", "value": `> Check connection to SAR AS, NA, EU game servers and <@!${discordClient.user.id}>'s server.` },
                { "name": "sk server setting", "value": `> Changes bot's behavior on a Discord server.\n> You need moderator privileges!` },
                { "name": "For [player] argument, you can use:", "value": `> •@Discord mention (<@!${discordClient.user.id}>)\n> •Steam profile page link (http://steamcommunity.com/profiles/76561198098039571)\n> •Royale.pet page link (https://royale.pet/player/76561198098039571)\n> •Steam custom URL (http://steamcommunity.com/id/LowFatBananamilk)\n> •Steam custom URL name (lowfatbananamilk)` }
            ];

            const m = await message.channel.send({ files: [{attachment: './Skullmilk_Banner.png', name: 'Skullmilk_Banner.png'}], embed: embed });
            m.react("🗑️");
            const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "🗑️"), { time: 180000 });
            collector.on('collect', async(reaction, user) => {
                collector.stop();
                embed = Object.assign({}, text.defaultEmbed);
                embed.title = "Manual closed";
                m.edit("`sk help` to view list of commands", { embed });
            });
            collector.on('end', collected => {
                if (messageInfo.message.guild) {
                    const userReactions = m.reactions.cache.filter(reaction => reaction.emoji.name == "🗑️");
                    for (const reaction of userReactions.values())
                        reaction.users.remove(discordClient.user.id);
                }
            });
        }

        else if (command == "bot" || command == "adopt") {
            // var embed = Object.assign({}, text.defaultEmbed);
            // embed.title = "Manual";
            message.channel.send("Nothing to see here for now~\nBot's invite url: <https://discord.com/api/oauth2/authorize?client_id=662186168204525579&permissions=44096&scope=bot>");
        }

        else if(command == "serversetting" || command == "serversettings" || command == "server" && (args[0] == "setting" || args[0] == "settings") || (command == "setting" || command == "settings") && args[0] == "server") {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;
            if (!message.guild)
                message.channel.send("This command is for servers only. Did you mean `sk setting`?");

            else if (!message.member.hasPermission("ADMINISTRATOR"))
                message.channel.send(text.common.msg.permission[lang]);
            else
                ServerSetting(messageInfo);
        }

        else if (command == "ping" ||command == "gameserver" || command == "gameservers" || command == "server" || command == "servers" || command == "game" && (ags[0] == "server" || args[0] == "servers"))
            PingGameServer(messageInfo);

        else if (command == "track" || command == "tracking" || command == "matchreport" || command == "matchreports" || command == "match" && (args[0] == "report" || args[0] == "reports")) {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

            if (!accounts[message.author.id]) {
                message.channel.send(text.common.msg.notLinkedSelf[lang]);
                return;
            }

            if (args[0] == "off" || args[0] == "stop" || args[1] == "off" || args[1] == "stop") {
                if (!track[message.author.id])
                    message.channel.send(text.track.msg.notTracking[lang]);
                else {
                    message.channel.send(text.track.menu.off[lang]);
                    delete(track[message.author.id]);
                    SaveFile("./tracker.json", track);
                }
                return;
            }


            if (track[message.author.id]) { // in list
                if (message.guild) { // msg from a server
                    if (message.guild.id == track[message.author.id].guild) {
                        if (track[message.author.id].channel != message.channel.id) { // wrong channel
                            const m = await message.channel.send(text.track.msg.wrongChannel[lang].replace("<CHANNELID>", `<#${track[message.author.id].channel}>`));
                            TrackCollector(messageInfo, m, lang);
                        }
                        else {  // show menu
                            const m = await message.channel.send(text.track.menu.title[lang]);
                            TrackCollector(messageInfo, m, lang);
                        }
                    }
                    else {  // wrong server
                        const m = await message.channel.send(text.track.msg.wrongServer[lang]);
                        TrackCollector(messageInfo, m, lang);
                    }
                }
                else {  // msg from dm
                    if (track[message.author.id].dm) { // show menu
                        const m = await message.channel.send(text.track.menu.title[lang]);
                        TrackCollector(messageInfo, m, lang);
                    }
                    else {  // show wich server which channel
                        const m = await message.channel.send(text.track.msg.wrongDm[lang].replace("<CHANNEL>", `<#${track[message.author.id].channel}>`).replace("<SERVER>", discordClient.guilds.cache.get(track[message.author.id].guild).name));
                        TrackCollector(messageInfo, m, lang);
                    }
                }
            }
            else {  // strat tracking
                if (message.guild) {
                    if (message.guild.id == "749948187908767824" && message.channel.id != "761579409186095155") {
                        message.channel.send("This server doesn't allow match reports on other channels. Try again on <#761579409186095155>");
                        return;
                    }
                    else
                        track[message.author.id] = {
                            "guild": message.guild.id,
                            "channel": message.channel.id
                        };
                }
                else {
                    discordClient.guilds.cache.forEach(guild => {
                        if (guild.member(message.author.id))
                            track[message.author.id] = {
                                "guild": guild.id,
                                "dm": true
                            };
                    });
                    if (!track[message.author.id] || !track[message.author.id].dm) {
                        message.channel.send(text.track.msg.dmFail[lang].replace("<BOT>", `<@!${messageInfo.botId}>`));
                        return;
                    }
                }
                SaveFile("./tracker.json", track);

                var m;
                if (!track[message.author.id].dm)
                    m = await message.channel.send(text.track.msg.start[lang]);
                else
                    m = await message.channel.send(`${text.track.msg.start[lang]}\n${text.track.msg.dmSuccess[lang]}`);
                TrackCollector(messageInfo, m, lang);
            }        
        }

        else if (command == "profile" || command == "statistic" || command == "statistics") {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

            if (!args[0]) {
                if (!accounts[message.author.id])
                    message.channel.send(text.common.msg.notLinkedSelf[lang]);
                else
                    Profile(messageInfo, accounts[message.author.id].SteamID64, accounts[message.author.id].PlayFabID);
            }
            else {
                const user = getUserFromMention(args[0]);
                if (user) {
                    if(!accounts[user.id])
                        message.channel.send(text.profile.msg.notLinked[lang])
                    else
                        Profile(messageInfo, accounts[user.id].SteamID64, accounts[user.id].PlayFabID);
                }
                else {
                    FindSteamAndPlayFabID(messageInfo, args[0]).then(ID =>{
                        Profile(messageInfo, ID[0], ID[1]);
                    });
                }
            }            
        }
        
        else if (command == "link") {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

            if (args[0] == null) {
                if (!accounts[message.author.id])
                    message.channel.send(text.link.intro[lang]);
                else {
                    ShowLinkedAccount(messageInfo);
                }
            }
            else
                LinkAccount(messageInfo, args[0]);
        }

        else if (command == "unlink") {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

            if (accounts[message.author.id]) {
                delete(accounts[message.author.id]);
                SaveFile("./accounts.json", accounts);
                var msg = "";
                if (track[message.author.id]) {
                    msg = `${text.track.menu.off[lang]}\n`;
                    delete(track[message.author.id]);
                    SaveFile("./tracker.json", track);
                }
                message.channel.send(msg + text.link.unLinked[lang]);
            }
            else
                message.channel.send(text.link.notLinked[lang]);
        }

        else if (command == "lang") {
            const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

            if (!accounts[message.author.id])
                message.channel.send(text.link.intro[lang]);
            else
                LangSetting(messageInfo)

        }

        else if (command == "quiz") {
            if (!args[0])
                QuizUI(messageInfo);
            else {
                if (!args[1])
                    args[1] = 3
                if (!args[2])
                    args[2] = 8
                switch(args[0]) {
                case "n":
                    QuizStart(messageInfo, "novice", args[1], args[2] * 1000); break;
                case "i":
                    QuizStart(messageInfo, "intermediate", args[1], args[2] * 1000); break;
                case "e":
                    QuizStart(messageInfo, "expert", args[1], args[2] * 1000); break;
                case "m":
                    QuizStart(messageInfo, "mixed", args[1], args[2] * 1000); break;
                case "stop":
                    return; 
                default:
                    message.channel.send("Wrong arguments.. Try `sk quiz [n/i/e/m] [# of questions] [timer in seconds]`");
                }
            }
        }
    }
});

discordClient.on('presenceUpdate', async (oldPresence, newPresence) => {
    if (!oldPresence)
        return;
    else if (track[newPresence.userID] == null) // not in tracking list
        return;
    const i = newPresence.activities.findIndex(activity => activity.applicationID == keys.SARDiscordID);
    if (i == -1)
        return;
    const j = oldPresence.activities.findIndex(activity => activity.applicationID == keys.SARDiscordID);
    if (j == -1)
        return;
    else if (track[newPresence.userID].guild != newPresence.guild.id) // filter out multiple calls from different server
        return;

    const details = {"old": oldPresence.activities[j].details, "new": newPresence.activities[i].details}
    var status = {};
    new Array("old", "new").forEach(function(key) {
        if (details[key].includes("Playing solos"))
            status[key] = 3;
        else if (details[key].includes("Playing duos"))
            status[key] = 4;
        else if (details[key].includes("Playing squads"))
            status[key] = 5;
        else if (details[key].includes("Playing SAW vs Rebellion"))
            status[key] = 6;
        else if (details[key] == "Main menu")
            status[key] = 0;
        else if (details[key].includes("Currently in game"))
            status[key] = 1;
        else if (details[key].includes("in lobby"))
            status[key] = 2;
    });

    if(status.old == status.new)
        return;
    
    var messageInfo = {
        serverLang: track[newPresence.userID].dm ? "en" : servers[newPresence.guild.id].lang,
        userLang: accounts[newPresence.userID] ? accounts[newPresence.userID].lang : null,
        userId: newPresence.userID
    };

    MatchReport(messageInfo, status);
});

function getUserFromMention(mention) {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!'))
			mention = mention.slice(1);

		return discordClient.users.cache.get(mention);
	}
}

discordClient.login(keys.discordApiToken);