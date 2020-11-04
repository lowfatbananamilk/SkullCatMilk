const Discord = require("discord.js");
const Steam = require("steamapi");
const PlayFab = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFab");
const PlayFabClient = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFabClient");
const ping = require("ping");
const flag = require("country-code-emoji");

const text = require("./language.json");
const keys = require("./keys.json");
const lists = require("./lists.json");

const fs = require('fs');
let accounts = JSON.parse(fs.readFileSync("./accounts.json"));
let servers = JSON.parse(fs.readFileSync("./servers.json"));
let track = JSON.parse(fs.readFileSync("./tracker.json"));

const collectionTime = 180000;
var langList = [];
for (language in text.langInfo)
    langList.push(language);
const langListSize = Object.keys(text.langInfo).length;

var steam = new Steam(keys.SteamApiKey);
setInterval(() => {
    delete steam;
    steam = new Steam(keys.SteamApiKey);
}, 86400000);

module.exports = function() {
    this.discordClient = new Discord.Client();

    this.keys = keys;
    this.text = text;

    this.accounts = accounts;
    this.servers = servers;
    this.track = track;    

    this.SaveFile = function(file, json) {
        fs.writeFile(file, JSON.stringify(json, null, "\t"), (err) => {
            if (err)
                console.log(`Error on writing ${file}`);
        });
    };

    this.FindSteamAndPlayFabID = function(messageInfo, search) {
        var lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;
    
        return new Promise(function(resolve, reject) {
            steam.resolve(search).then(steamID => {
                PlayFabClient.GetPlayFabIDsFromSteamIDs({ SteamStringIDs: steamID }, (error, result) => {
                    if (result) {
                        if (!result.data.Data[0].PlayFabId)
                            messageInfo.message.channel.send(text.common.msg.noPlayFab[lang]);
                        else 
                            resolve([steamID, result.data.Data[0].PlayFabId]);
                    }
                });
            }).catch(err => { messageInfo.message.channel.send(text.common.msg.noSteam[lang]); });
        });
    };

    this.ServerSetting = async function(messageInfo) {
        var lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

        var embed = Object.assign({}, text.defaultEmbed);
        embed.title = text.setting.modSetting[lang];
        embed.fields = SettingsEmbedFields(lang, servers[messageInfo.message.guild.id]);

        const m = await messageInfo.message.channel.send({ embed });
        await m.react("1️⃣");
        await m.react("2️⃣");
        m.react("3️⃣");

        var index = langList.indexOf(servers[messageInfo.message.guild.id].lang);
        const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "1️⃣" || reaction.emoji.name == "2️⃣" || reaction.emoji.name == "3️⃣"), { time: collectionTime });
        collector.on('collect', async (reaction, user) => {
            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "1️⃣" || reaction.emoji.name == "2️⃣" || reaction.emoji.name == "3️⃣"));
            for (const reaction of userReactions.values())
                reaction.users.remove(user.id);

            if (user == messageInfo.message.author.id) {
                switch(reaction.emoji.name) {
                case "1️⃣":
                    servers[messageInfo.message.guild.id].allowTrack = !servers[messageInfo.message.guild.id].allowTrack; break;
                case "2️⃣":
                    servers[messageInfo.message.guild.id].defaultChannel = messageInfo.message.channel.id; break;
                case "3️⃣":
                    if (++index >= langListSize)
                        index = 0;
                    servers[messageInfo.message.guild.id].lang = langList[index];
                }
                if (!messageInfo.userLang)
                    lang = messageInfo.serverLang;
                
                embed.title = text.setting.modSetting[lang];
                embed.fields = SettingsEmbedFields(lang, servers[messageInfo.message.guild.id]);
                m.edit({ embed });

                SaveFile("./servers.json", servers);
            }
        });
        collector.on('end', collected => {
            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
            for (const reaction of userReactions.values())
                reaction.users.remove(discordClient.user.id);
        });
    };

    this.PingGameServer = async function(messageInfo) {
        var lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

        var embed = Object.assign({}, text.defaultEmbed);
        embed.title = text.gameServer[lang];
        embed.footer = {"text": text.gameServer.footer[lang]};
        embed.fields = null;

        const m = await messageInfo.message.channel.send(text.gameServer.start[lang], { embed });
        const skPing = (m.createdTimestamp - messageInfo.message.createdTimestamp) / 2;

        embed.fields = await PingEmbedFields();
        embed.fields.push({"name": "SkullCat Milk", value: `${skPing / 2}ms.`});

        m.edit(null, { embed });
        m.react("🔄");

        const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && reaction.emoji.name == "🔄", { time: collectionTime });
        collector.on('collect', async(reaction, user) => {
            if (messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && reaction.emoji.name == "🔄");
                for (const reaction of userReactions.values())
                    reaction.users.remove(user.id);
                        
                lang = accounts[user.id] ? accounts[user.id].lang : messageInfo.serverLang;
                embed.title = text.gameServer[lang];
                embed.footer = {"text": text.gameServer.footer[lang]};
            }
                     
            await m.edit(text.gameServer.start[lang], { embed });

            embed.fields = await PingEmbedFields();
            embed.fields.push({"name": "SkullCat Milk", value: `${skPing / 2}ms. (${text.gameServer.last[lang]})`});
                
            m.edit(null, { embed });
        });
        collector.on('end', collected => {
            if (messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                for (const reaction of userReactions.values())
                    reaction.users.remove(discordClient.user.id);
            }
        });
    };

    this.TrackCollector = async function(messageInfo, m, lang) {
        if (lang)
            m.edit(`${m.content}\n${text.track.menu[lang]}`);

        await m.react("⏹");
        if (lang)
            await m.react("🔽");
        await m.react("🔴");
        if (!lang && !track[messageInfo.userId].dm)
            m.react("🗑️");

        const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "⏹" || reaction.emoji.name == "🔽" || reaction.emoji.name == "🔴" || reaction.emoji.name == "🗑️"), { time: collectionTime });
        collector.on('collect', async(reaction, user) => {
            // track[messageInfo.userId] is undefined
            if (!lang ? !track[messageInfo.userId].dm : messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "⏹" || reaction.emoji.name == "🔽" || reaction.emoji.name == "🔴" || reaction.emoji.name == "🗑️"));
                for (const reaction of userReactions.values())
                    reaction.users.remove(user.id);
            }
                
            if (user == (!lang ? messageInfo.userId : messageInfo.message.author.id))
                switch(reaction.emoji.name) {
                case "⏹":
                    collector.stop();

                    if (lang)
                        m.edit(text.track.menu.off[lang]);
                            
                    delete(track[user.id]);
                    SaveFile("./tracker.json", track); break;
                case "🔽":
                    if (messageInfo.message.guild && messageInfo.message.guild.id == "749948187908767824" && messageInfo.message.channel.id != "761579409186095155") {
                        await m.edit("This server doesn't allow match reports on other channels. Try again on <#761579409186095155>\n"+text.track.menu[lang]);
                        return;
                    }
                    if (lang) {                    
                        m.edit(`${text.track.menu.channelSwitch[lang]}\n${text.track.menu[lang]}`);
                        
                        if (messageInfo.message.guild) {
                            track[user.id].guild = m.guild.id;
                            track[user.id].channel = m.channel.id;
                        }
                        else {
                            discordClient.guilds.cache.forEach(guild => {
                                if (guild.member(user.id)) {
                                    track[user.id].guild = guild.id;
                                    track[user.id].dm = true;
                                }
                            });
                            if (!track[user.id].dm) {
                                message.channel.send(text.track.msg.dmFail[lang].replace("<BOT>", `<@!${discordClient.user.id}>`));
                                return;
                            }
                        }
                        SaveFile("./tracker.json", track);
                    }
                    break;
                case "🔴":
                    if (lang)
                        await m.edit(`${text.track.menu.mention[!accounts[user.id].reportMention][lang]}\n${text.track.menu[lang]}`);

                    accounts[user.id].reportMention = !accounts[user.id].reportMention;
                    SaveFile("./accounts.json", accounts); break;
                case "🗑️":
                    if (!lang && !track[messageInfo.userId].dm) {
                        collector.stop();

                        var embed = Object.assign({}, text.defaultEmbed);
                        embed.title = text.track.menu.remove[messageInfo.serverLang];
                        m.edit({ embed });
                    }
                }
        });
        collector.on('end', collected => {
            // track[messageInfo.userId] is undefined
            if (!lang ? !track[messageInfo.userId].dm : messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                for (const reaction of userReactions.values())
                    reaction.users.remove(discordClient.user.id);
            }
        });
    };

    this.MatchReport = function(messageInfo, status) {
        RetrieveStat(accounts[messageInfo.userId].PlayFabID).then(async stat => {
            if (status.old < status.new || status.old > 3 && status.new > 2) {
                track[messageInfo.userId].Stat = stat;
                SaveFile("./tracker.json", track);
            }
            else if (status.old > 2) {
                var type;
                switch(status.old) {
                case 3:
                    type = ""; break;
                case 4:
                    type = "Duos"; break;
                case 5:
                    type = "Squads"; break;
                case 6:
                    type = "Custom1";
                }

                const lang = track[messageInfo.userId].dm ? (messageInfo.userLang ? messageInfo.userLang : "en") : messageInfo.serverLang;
                
                if (!track[messageInfo.userId].Stat) {
                    if (track[messageInfo.userId].dm)
                        discordClient.users.cache.get(messageInfo.userId).send("start tracking before playing a match");
                    else
                        discordClient.channels.cache.get(track[messageInfo.userId].channel).send("start tracking before playing a match");
                    return;
                }
                else if (stat["Games" + type] == track[messageInfo.userId].Stat["Games" + type]) {
                    console.log("in same match");
                    return;
                }


                var embed = Object.assign({}, text.defaultEmbed);
                embed.title = `${text.track.report.matchComplete[lang].replace("<GAMETYPE>", type == "" ? text.common.GAMETYPE.Solos[lang] : (type == "Custom1" ? "SAW vs Rebellion" : text.common.GAMETYPE[type][lang]))}`
                    + `\n${discordClient.users.cache.get(messageInfo.userId).tag}`;
                        
                var m;
                if (track[messageInfo.userId].dm)
                    m = await discordClient.users.cache.get(messageInfo.userId).send(text.track.report.start[lang], { embed });
                else
                    m = await discordClient.channels.cache.get(track[messageInfo.userId].channel).send(accounts[messageInfo.userId].reportMention ? `<@!${messageInfo.userId}>\n` : "" + text.track.report.start[lang], { embed });

                const xp = stat.AccountExpIntoCurrentLevelNew;
                Object.keys(stat).forEach(function(statistic) {
                    stat[statistic] -= track[messageInfo.userId].Stat[statistic];
                });                    
                    
                if (stat["Games" + type] > 1) {
                    m.edit(text.track.msg.lost[lang].replace("<USER>", `<@!${messageInfo.userId}>`));
                    return;
                }                            

                steam.getUserSummary(accounts[messageInfo.userId].SteamID64).then(async summary => {
                    console.log("working on it!")
                    embed.title = ReportEmbedTitle(lang, stat, type, summary.nickname, xp, messageInfo.userId);
                    embed.thumbnail =  {"url": summary.avatar.large};
                    embed.fields = ReportEmbedFields(lang, stat, type);

                    await m.edit(accounts[messageInfo.userId].reportMention && !track[messageInfo.userId].dm ? `<@!${messageInfo.userId}>\n` : null, { embed });
                    TrackCollector(messageInfo, m, false);                                     
                });
            }
        });
    };

    this.Profile = function(messageInfo, steamID, playFabID) {
        var lang = !messageInfo.message.guild ? (messageInfo.userLang ? messageInfo.userLang : "en") : messageInfo.serverLang;

        steam.getUserSummary(steamID).then(async summary => {
            RetrieveRank(playFabID).then(async data => {
                var embed = Object.assign({}, text.defaultEmbed);
                embed = NameCardEmbed(data[0], summary, lang);
                embed.description = ProfileEmbedDescription(lang);
                embed.thumbnail = {"url": summary.avatar.large};
                embed.fields = ProfileEmbedFields(lang, data[0], data[1]);

                const m = await messageInfo.message.channel.send({ embed });
                await m.react("◀");
                await m.react("🔄");
                await m.react("▶");
                if (messageInfo.message.guild)
                    m.react("🗑️")
                
                var page = 0;
                const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "◀" || reaction.emoji.name == "🔄" || reaction.emoji.name == "▶" || reaction.emoji.name == "🗑️"), { time: collectionTime });
                collector.on('collect', async(reaction, user) => {
                    if (messageInfo.message.guild) {
                        const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "◀" || reaction.emoji.name == "🔄" || reaction.emoji.name == "▶" || reaction.emoji.name == "🗑️"));
                        for (const reaction of userReactions.values())
                            reaction.users.remove(user.id);

                        lang = accounts[user.id] ? accounts[user.id].lang : messageInfo.serverLang;
                    }
                        
                    switch(reaction.emoji.name) {
                    case "◀":
                        if (--page < 0)
                            page = 4;
                            
                        embed = NameCardEmbed(data[0], summary, lang);
                        embed.description = ProfileEmbedDescription(lang, page);
                        embed.fields = ProfileEmbedFields(lang, data[0], data[1], page);
                        m.edit({ embed }); break;
                    case "🔄":
                        embed = NameCardEmbed(data[0], summary, lang);
                        embed.description = ProfileEmbedDescription(lang, page);
                        embed.fields = ProfileEmbedFields(lang, data[0], data[1], page);
                        m.edit({ embed }); break;
                    case "▶":
                        if (++page > 4)
                            page = 0;
                            
                        embed = NameCardEmbed(data[0], summary, lang);
                        embed.description = ProfileEmbedDescription(lang, page);
                        embed.fields = ProfileEmbedFields(lang, data[0], data[1], page);
                        m.edit({ embed }); break;
                    case "🗑️":
                        if (messageInfo.message.guild && user.id == messageInfo.message.author.id) {
                            collector.stop();
    
                            var embed = Object.assign({}, text.defaultEmbed);
                            embed.title = text.profile.msg.close[messageInfo.serverLang];
                            m.edit({ embed });
                        }
                    }
                });
                collector.on('end', collected => {
                    if (messageInfo.message.guild) {
                        const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                        for (const reaction of userReactions.values())
                            reaction.users.remove(discordClient.user.id);
                    }
                });
            });                                                 
        });

    };

    this.NameCardEmbed = function(stat, summary, lang = "en") {
        var embed = Object.assign({}, text.defaultEmbed);
        embed.title = summary.nickname;
    
        if (summary.countryCode)
            embed.title += ` | ${flag(summary.countryCode)} ${summary.countryCode}`;
        if (summary.gameId)
            embed.title += `\n🟢 Playing ${summary.gameId == keys.SARSteamID ? "SAR" : "Other Games"}`
        else
            switch(summary.personaState) {
            case 0:
                embed.title += `\n⚪ ${text.common.status.offline[lang]}`; break;
            case 1:
                embed.title += `\n🔵 ${text.common.status.online[lang]}`; break;
            case 2:
                embed.title += `\n⛔ ${text.common.status.busy[lang]}`; break;
            case 3:
                embed.title += `\n☕ ${text.common.status.away[lang]}`; break;
            case 4:
                embed.title += `\n💤 ${text.common.status.snooze[lang]}`;
            }
        embed.title +=`\nLV.${stat.AccountLevelNew} ${XPChart(stat.AccountLevelNew, stat.AccountExpIntoCurrentLevelNew)} (${stat.AccountExpIntoCurrentLevelNew}/${MaxXP(stat.AccountLevelNew)})`;
        embed.thumbnail = {"url": summary.avatar.large};
    
        return embed;
    };

    this.LinkAccount = function(messageInfo, search) {
        const lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;
        
        FindSteamAndPlayFabID(messageInfo, search).then(ID => {
            RetrieveStat(ID[1]).then(stat => {
                steam.getUserSummary(ID[0]).then(async summary => {
                    var embed = NameCardEmbed(stat, summary, lang); 

                    const m = await messageInfo.message.channel.send(text.link.confirm[messageInfo.serverLang], { embed });
                    await m.react("✔");
                    await m.react("❌");
                    const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "✔" || reaction.emoji.name == "❌" || reaction.emoji.name == "🗑️"), { time: collectionTime });
                    var done = false;
                    collector.on('collect', async(reaction, user) => {
                        if (messageInfo.message.guild) {
                            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "✔" || reaction.emoji.name == "❌" || reaction.emoji.name == "🗑️"));
                            for (const reaction of userReactions.values())
                                reaction.users.remove(user.id);
                        }
                
                        if (user == messageInfo.message.author.id)
                            switch(reaction.emoji.name) {
                            case "✔":
                                if (messageInfo.message.guild) {
                                    const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                                    for (const reaction of userReactions.values())
                                        reaction.users.remove(discordClient.user.id);
                                    m.react("🗑️");
                                    done = true;
                                }
                                else
                                    collector.stop();

                                accounts[user.id] = {
                                    DiscordTag: user.tag,
                                    Resolve: search,
                                    SteamID64: ID[0],
                                    PlayFabID: ID[1],
                                    lang: messageInfo.message.guild ? messageInfo.serverLang : "en"
                                };

                                var guess = false;
                                if (summary.countryCode) //flag() returns error when undefined
                                    guess = LangSwitch(flag(summary.countryCode))
                                if (guess) {
                                    m.edit(`${text.link.complete[guess]}\n${text.link.lang[guess].replace("<FLAG>", flag(summary.countryCode)).replace("<LANG>", guess)} You can later change your language in \`sk lang\``, { embed });
                                    accounts[user.id].lang = guess;
                                }
                                else
                                    m.edit(`${text.link.complete[messageInfo.serverLang]}\nYou can set your language preference in \`sk lang\``, { embed });
                                SaveFile("./accounts.json", accounts); break;    
                            case "❌":
                                if (done)
                                    break;
                            case "🗑️":
                                collector.stop();
                                
                                embed.title = text.link.close[messageInfo.message.guild ? messageInfo.serverLang : lang];
                                delete embed.thumbnail;
                                m.edit(null, { embed });
                            }
                    });
                    collector.on('end', collected => {
                        if (messageInfo.message.guild) {
                            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                            for (const reaction of userReactions.values())
                                reaction.users.remove(discordClient.user.id);
                        }
                    });
                });
            });
        });
    };

    this.ShowLinkedAccount = function(messageInfo) {
        var lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

        RetrieveStat(accounts[messageInfo.message.author.id].PlayFabID).then(stat => {
            steam.getUserSummary(accounts[messageInfo.message.author.id].SteamID64).then(async summary => {
                const embed = NameCardEmbed(stat, summary, lang);
                messageInfo.message.channel.send(text.link.view[lang], { embed });
            });
        });
    };

    this.LangSetting = async function(messageInfo) {
        var lang = messageInfo.userLang ? messageInfo.userLang : messageInfo.serverLang;

        var embed;
        await LangEmbed(lang).then(emb => { embed = emb });

        const m = await messageInfo.message.channel.send(text.lang.msg[lang].replace("<FLAG>", LangSwitch(messageInfo.serverLang)).replace("<LANG>", messageInfo.serverLang), { embed });
        await m.react("🇬🇧");
        await m.react("🇰🇷");
        await m.react("🇹🇼");
        await m.react("🇨🇳");
        await m.react("🇲🇾");
        m.react("🇪🇸");

        const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "🇬🇧" || reaction.emoji.name == "🇰🇷" || reaction.emoji.name == "🇨🇳" || reaction.emoji.name == "🇹🇼" || reaction.emoji.name == "🇲🇾" || reaction.emoji.name == "🇪🇸"), { time: collectionTime });
        collector.on('collect', async (reaction, user) => {
            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "🇬🇧" || reaction.emoji.name == "🇰🇷" || reaction.emoji.name == "🇨🇳" || reaction.emoji.name == "🇹🇼" || reaction.emoji.name == "🇲🇾" || reaction.emoji.name == "🇪🇸"));
            if (messageInfo.message.guild) {
                for (const reaction of userReactions.values())
                    reaction.users.remove(user.id);
            }

            if (user == messageInfo.message.author.id) {
                lang = LangSwitch(reaction.emoji.name);
                accounts[messageInfo.message.author.id].lang = lang;
                SaveFile("./accounts.json", accounts);

                discordClient.users.fetch(text.langInfo[lang]).then(async translator => {
                    await LangEmbed(lang).then(emb => { embed = emb });
                    embed.footer = { "icon_url": translator.avatarURL(), "text": text.lang.footer[lang].replace("<YOU>", translator.tag)};
                    
                    m.edit(text.lang.set[lang], { embed });
                });
            }
        });
        collector.on('end', collected => {
            if (messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                for (const reaction of userReactions.values())
                    reaction.users.remove(discordClient.user.id);

            }
            delete embed.fields;
            discordClient.users.fetch("480262009716211712").then(bananamilk => {
                embed.description = text.lang.description[messageInfo.serverLang].split("\n\n")[0].replace("<BANANAMILK>", `<@!${bananamilk.tag}>`);
                
                m.edit({ embed });
            });
        });
    }

    this.QuizStart = async function(messageInfo, type, amount, ansTime) {
        if (type == "mixed")
            quiz = lists.quizzes.novice.concat(lists.quizzes.intermediate).concat(lists.quizzes.expert);
        else
            quiz = lists.quizzes[type];

        if (amount > quiz.length) {
            messageInfo.message.channel.send(`We currently only have ${quiz.length} questions in ${type} pool. Srry`);
            return;
        }

        var stopRequest = false;
        const quizStop = messageInfo.message.channel.createMessageCollector(m => m.content.toLowerCase() == "sk quiz stop", { time: 500000 });
        quizStop.on('collect', m => {
            if (m.author.id == messageInfo.message.author.id || messageInfo.message.member.hasPermission("ADMINISTRATOR")) {
                quizStop.stop();
                stopRequest = true;

                messageInfo.message.channel.send(`<@!${m.author.id}> has stopped all the quizzes in this channel.`);
            }
            else
                messageInfo.message.channel.send(`You don't have a permission to stop the quiz.\nAsk the host <@!${messageInfo.message.author.id}> or any server moderator for help!`);
        });

        var count = 0;
        var quizList = [];
        var quizScore = [];

        async function SingleQuiz() {
            if (stopRequest)
                return;
            if (count == amount) {
                var embed = Object.assign({}, text.defaultEmbed);
                embed.title = "SAR QUIZ";
                embed.footer = {"text": `${type} difficulty | ${amount} questions | ⏱️ ${ansTime / 1000}sec. to answer`};
                embed.description = "GG The quiz is now over!\nGot unique questions by yourself? Share it with us!\n\nHere's everyone who perticipated:"
                embed.fields = [];

                count = 0;
                Object.keys(quizScore).sort(function(a, b) {
                    return quizScore[b] - quizScore[a]
                }).forEach(async function(playerId) {
                    await discordClient.users.fetch(playerId).then(async player => {
                        embed.fields.push(
                            {
                                "name": `#${++count}\t${player.tag}`,
                                "value": "** **",
                                "inline": true
                            },
                            {
                                "name": `${quizScore[playerId]} Correct answers`,
                                "value": "** **",
                                "inline": true
                            },
                            { "name": "** **", "value": "** **", "inline": true}
                        );
                    });
                });

                setTimeout(function Check() {
                    if (count == Object.keys(quizScore).length)
                        messageInfo.message.channel.send({ embed });
                    else
                        setTimeout(Check, 100);
                }, 100);
            }
            else {
                var quizIndex = Math.floor(Math.random() * (quiz.length));
                while (quizList.includes(quizIndex))
                    quizIndex = Math.floor(Math.random() * (quiz.length));
                quizList.push(quizIndex);
        
                var player = 0;
                var answers = {};
                var answerCount = [0, 0, 0, 0];
                var timer = ansTime;
                var tick;
        
                var embed = Object.assign({}, text.defaultEmbed);
                embed.fields = [
                    { "name": `***Q${++count}: ${quiz[quizIndex].Q}***`, "value": "** **" }
                ];
                var optionIndex = 0;
                quiz[quizIndex].O.forEach(function(option) {
                    embed.fields.push({ "name": `${QuizSwitch(optionIndex++)} ${option}`, "value": "** **"});
                });
                //embed.fields.push({ "name": "** **", "value": `${type} difficulty | ${amount} questions | ⏱️ ${ansTime / 1000}sec. to answer` });
                embed.footer = { "text": `⏱️ ${timer / 1000}sec to answer.` };
        
                const m = await  messageInfo.message.channel.send({ embed });
                m.react("🇦");
                m.react("🇧");
                m.react("🇨");
                await m.react("🇩");

                tick = setInterval(() => {
                    timer -= 1000;
                    embed.footer.text = `⏱️ ${timer / 1000}sec to answer.${player ? `\t${player} ${player < 2 ? "person has" : "people have"} answered!` : ""}`;
                    m.edit({ embed });
                }, 1000);
                       
                const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "🇦" || reaction.emoji.name == "🇧" || reaction.emoji.name == "🇨" || reaction.emoji.name == "🇩" || reaction.emoji.name == "🇪" || reaction.emoji.name == "🇫"), { time: ansTime + 1000 });
                collector.on('collect', async (reaction, user) => {
                    const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "🇦" || reaction.emoji.name == "🇧" || reaction.emoji.name == "🇨" || reaction.emoji.name == "🇩" || reaction.emoji.name == "🇪" || reaction.emoji.name == "🇫"));
                    if (messageInfo.message.guild)
                        for (const reaction of userReactions.values())
                            reaction.users.remove(user.id);
                    
                    if (stopRequest) {
                        collector.stop();
                        return;
                    }

                    if (!answers[user.id]) {
                        embed.footer.text = `⏱️ ${timer / 1000}sec to answer.\t${++player} ${player < 2 ? "person has" : "people have"} answered!`;
                        m.edit({ embed });
                    }
        
                    answers[user.id] = QuizSwitch(reaction.emoji.name) + 1;
                });

                collector.on('end', collected => {
                    clearInterval(tick);

                    if (messageInfo.message.guild) {
                        const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                        for (const reaction of userReactions.values())
                            reaction.users.remove(discordClient.user.id);
                    }

                    Object.keys(answers).forEach(function(player) {
                        if (answers[player] - 1 == quiz[quizIndex].A) {
                            if (!quizScore[player])
                                quizScore[player] = 1;
                            else
                                quizScore[player] += 1;
                        }
                        else if (!quizScore[player])
                            quizScore[player] = 0;

                        answerCount[answers[player] - 1]++;
                    });

                    embed.fields.splice(1, 0, { "name": `The correct answer is ||${QuizSwitch(quiz[quizIndex].A)} ${quiz[quizIndex].O[quiz[quizIndex].A]}||`, "value": "** **" });
                    if (player) {
                        embed.fields.splice(2);
                        optionIndex = 0;
                        quiz[quizIndex].O.forEach(function(option) {
                            embed.fields.push(
                                { "name": `${QuizSwitch(optionIndex)} ${option}`, "value": "** **", "inline": true},
                                { "name": `${(answerCount[optionIndex++] / player * 100).toFixed(0)}%`, "value": "** **", "inline": true},
                                { "name": "** **", "value": "** **", "inline": true}
                            );
                        });
                        //embed.fields.push({ "name": "** **", "value": `${type} difficulty | ${amount} questions | ⏱️ ${ansTime / 1000}sec. to answer` });
                    }
                    m.edit({ embed });

                    setTimeout(SingleQuiz, 5000);
                });
            }
        }

        if(!stopRequest)
            SingleQuiz();
    }

    this.QuizUI = async function(messageInfo) {
        var embed = Object.assign({}, text.defaultEmbed);
        embed.title = "SAR QUIZ";
        embed.description = "settings:";
        
        const type= ["Novice", "Intermediate", "Expert", "Mixed"];
        var typeIndex = 3;
        const amount = [1, 3, 5, 7, 10, 15, 17, 20];
        var amountIndex = 1;
        const ansTime = [8, 10, 12, 15];
        var ansTimeIndex = 0;
        
        embed.fields = [
            {
                "name": "1️⃣ Difficulty", "value": `${type[typeIndex]}`, "inline": true
            },
            {
                "name": "2️⃣ # of questions", "value": `${amount[amountIndex]}`, "inline": true
            },
            {
                "name": "** **", "value": "** **", "inline": true
            },
            {
                "name": "3️⃣ Answer timer", "value": `${ansTime[ansTimeIndex]}`, "inline": true
            },
            {
                "name": "▶ Start quiz!", "value": "** **", "inline": true
            },
            {
                "name": "** **", "value": "** **", "inline": true
            },
        ];

        const m = await messageInfo.message.channel.send("You can use `sk quiz [n/i/e/m] [# of questions] [timer in seconds]` for quick start!", { embed });
        await m.react("1️⃣")
        await m.react("2️⃣")
        await m.react("3️⃣")
        m.react("▶")

        const collector = m.createReactionCollector((reaction, user) => user != discordClient.user.id && (reaction.emoji.name == "1️⃣" || reaction.emoji.name == "2️⃣" || reaction.emoji.name == "3️⃣" || reaction.emoji.name == "▶"), { time: collectionTime });
        collector.on('collect', async (reaction, user) => {
            const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(user.id) && (reaction.emoji.name == "1️⃣" || reaction.emoji.name == "2️⃣" || reaction.emoji.name == "3️⃣" || reaction.emoji.name == "▶"));
            if (messageInfo.message.guild) {
            for (const reaction of userReactions.values())
                reaction.users.remove(user.id);
            }

            if (user == messageInfo.message.author.id) {
                switch(reaction.emoji.name) {
                case "1️⃣":
                    if (++typeIndex > 3)
                        typeIndex = 0;
                    break;
                case "2️⃣":
                    if (++amountIndex > 7)
                        amountIndex = 0;
                    break;
                case "3️⃣":
                    if (++ansTimeIndex > 3)
                        ansTimeIndex = 0;
                    break;
                case "▶":
                    collector.stop();
                    QuizStart(messageInfo, type[typeIndex].toLowerCase(), amount[amountIndex], ansTime[ansTimeIndex] * 1000);
                    return;
                }
                
                embed.fields = [
                    {
                        "name": "1️⃣ Difficulty", "value": `${type[typeIndex]}`, "inline": true
                    },
                    {
                        "name": "2️⃣ # of questions", "value": `${amount[amountIndex]}`, "inline": true
                    },
                    {
                        "name": "** **", "value": "** **", "inline": true
                    },
                    {
                        "name": "3️⃣ Answer timer", "value": `${ansTime[ansTimeIndex]}`, "inline": true
                    },
                    {
                        "name": "▶ Start quiz!", "value": "** **", "inline": true
                    },
                    {
                        "name": "** **", "value": "** **", "inline": true
                    },
                ];
                m.edit({ embed });
            }
        });
        collector.on('end', collected => {
            if (messageInfo.message.guild) {
                const userReactions = m.reactions.cache.filter(reaction => reaction.users.cache.has(discordClient.user.id));
                for (const reaction of userReactions.values())
                    reaction.users.remove(discordClient.user.id);
            }
        });
    }
};

function SettingsEmbedFields(lang, server) {
    return [
        {"name": "1. " + text.setting.modSetting.allowTrack[lang],
            "value": server.allowTrack},
        {"name": "2. " + text.setting.modSetting.channel[lang],
            "value": `<#${server.defaultChannel}>`},
        {"name": "3. Server Language",
            "value": `${LangSwitch(server.lang)} ${server.lang}`}
    ];
}

async function PingEmbedFields() {
    var fields = [];
    var count = 0;
    for (const host in keys.SARServer) {
        await ping.promise.probe(keys.SARServer[host]).then(function(result) {
            fields.push({
                "name": `${host} ${result.alive ? "🆙" : "⚠"}`,
                "value": result.alive ? `${result.avg}ms` : "-",
                "inline": true
            });
            count++;
        });

        if (count == 3)
            return fields;
    }
}
function RetrieveRank(playFabId) {
    return new Promise(function(resolve, reject) {
        PlayFabClient.GetLeaderboardAroundPlayer({
            MaxResultsCount: 1,
            PlayFabId: playFabId,
            StatisticName: "RatGG",
            ProfileConstraints: { ShowStatistics: true }
        }, (error, result) => {
            if (result != null) {
                var stat = {};
                var rank = {};
                const size = Object.keys(result.data.Leaderboard[0].Profile.Statistics).length;
                count = 0;
                result.data.Leaderboard[0].Profile.Statistics.forEach(function(statistic) {
                    stat[statistic.Name] = statistic.Value;

                    PlayFabClient.GetLeaderboardAroundPlayer(
                        { PlayFabId: playFabId, StatisticName: statistic.Name, MaxResultsCount: 1 },
                        (error, result) => {
                            rank[statistic.Name] = result.data.Leaderboard[0].Position + 1;
                            count++;
                        }
                    );
                });

                stat.AccountLevelNew++;

                stat.KillsAll = stat.Kills + stat.KillsDuos + stat.KillsSquads;
                stat.DeathsAll = stat.Deaths + stat.DeathsDuos + stat.DeathsSquads;

                stat.KdAll = stat.KillsAll / stat.DeathsAll;
                stat.Kd = stat.Kills / stat.Deaths;
                stat.KdDuos = stat.KillsDuos / stat.DeathsDuos;
                stat.KdSquads = stat.KillsSquads / stat.DeathsSquads;
                
                stat.WinsDuoSquads = stat.WinsDuos + stat.WinsSquads;
                stat.WinsAll = stat.Wins + stat.WinsDuos + stat.WinsSquads;
                stat.GamesAll = stat.Games + stat.GamesDuos + stat.GamesSquads;

                stat.AvgKillsAll = stat.KillsAll / stat.GamesAll;
                stat.AvgKills = stat.Kills / stat.Games;
                stat.AvgKillsDuos = stat.KillsDuos / stat.GamesDuos;
                stat.AvgKillsSquads = stat.KillsSquads / stat.GamesSquads;

                stat.WrAll = stat.WinsAll / stat.GamesAll;
                stat.Wr = stat.Wins / stat.Games;
                stat.WrDuos = stat.WinsDuos / stat.GamesDuos;
                stat.WrSquads = stat.WinsSquads / stat.GamesSquads;

                stat.Tr = stat.Top5 / stat.Games;
                stat.TrDuos = stat.Top3Duos / stat.GamesDuos;
                stat.TrSquads = stat.Top2Squads / stat.GamesSquads;
                
                stat.BananaHitsFriendly = stat.BananaHits - stat.BananaHitsEnemyOnly;

                setTimeout(function Check() {
                    //manual count failed suddenly 10.31 00:15
                    //console.log(`${count}/${size}`)
                    if (count == size)
                        resolve([stat, rank]);
                    else
                        setTimeout(Check, 100);
                }, 100);
            }
        });
    });
}

function RetrieveStat(playFabId) {
    return new Promise(function(resolve, reject) {
        PlayFabClient.GetLeaderboardAroundPlayer({
            MaxResultsCount: 1,
            PlayFabId: playFabId,
            StatisticName: "RatGG",
            ProfileConstraints: {ShowStatistics: true}
        }, (error, result) => {
            if (result != null) {
                var stat = {};
                result.data.Leaderboard[0].Profile.Statistics.forEach(function(statistic) {
                    stat[statistic.Name] = statistic.Value;
                });

                stat.AccountLevelNew++;

                stat.KillsAll = stat.Kills + stat.KillsDuos + stat.KillsSquads;
                stat.DeathsAll = stat.Deaths + stat.DeathsDuos + stat.DeathsSquads;

                stat.KdAll = stat.KillsAll / stat.DeathsAll;
                stat.Kd = stat.Kills / stat.Deaths;
                stat.KdDuos = stat.KillsDuos / stat.DeathsDuos;
                stat.KdSquads = stat.KillsSquads / stat.DeathsSquads;
                
                stat.WinsDuoSquads = stat.WinsDuos + stat.WinsSquads;
                stat.WinsAll = stat.Wins + stat.WinsDuos + stat.WinsSquads;
                stat.GamesAll = stat.Games + stat.GamesDuos + stat.GamesSquads;

                stat.AvgKillsAll = stat.KillsAll / stat.GamesAll;
                stat.AvgKills = stat.Kills / stat.Games;
                stat.AvgKillsDuos = stat.KillsDuos / stat.GamesDuos;
                stat.AvgKillsSquads = stat.KillsSquads / stat.GamesSquads;

                stat.WrAll = stat.WinsAll / stat.GamesAll;
                stat.Wr = stat.Wins / stat.Games;
                stat.WrDuos = stat.WinsDuos / stat.GamesDuos;
                stat.WrSquads = stat.WinsSquads / stat.GamesSquads;

                stat.Tr = stat.Top5 / stat.Games;
                stat.TrDuos = stat.Top3Duos / stat.GamesDuos;
                stat.TrSquads = stat.Top2Squads / stat.GamesSquads;
                
                stat.BananaHitsFriendly = stat.BananaHits - stat.BananaHitsEnemyOnly;

                resolve(stat);
            }
        });
    });
}

function ReportEmbedTitle(lang, stat, type, nickname, xp, id) {
    //return "TESTING";
    return `${text.track.report.matchComplete[lang].replace("<GAMETYPE>", type == "" ? text.common.GAMETYPE.Solos[lang] : (type == "Custom1" ? "SAW vs Rebellion" : text.common.GAMETYPE[type][lang]))}`
        + `\n${nickname}`
        + `\nLV.${track[id].Stat.AccountLevelNew + stat.AccountLevelNew} ${XPChart(track[id].Stat.AccountLevelNew + stat.AccountLevelNew, xp)} (${xp}/${MaxXP(track[id].Stat.AccountLevelNew + stat.AccountLevelNew)})`
        + `\n+${EarnedXP(track[id].Stat.AccountLevelNew, stat.AccountLevelNew, stat.AccountExpIntoCurrentLevelNew, track[id].Stat.AccountExpIntoCurrentLevelNew)} EXP`
        + `${stat["Wins" + type] ? ` Game Won!` : (type == "Custom1" ? "" : (stat["Top" + TopN(type) + type] ? ` TOP ${TopN(type)}!` : ""))}${stat.AccountLevelNew ? " LEVEL UP!" : ""}`;
}

function ReportEmbedFields(lang, stat, type) {
    var fields = [
        {
            "name": text.track.report.summary.Kills[lang].replace("<#>", stat["Kills" + type]),
            "value": text.track.report.summary.DamageDealt[lang].replace("<#>", stat.DamageDealt),
            "inline": true
        }
    ];
    if (type == "Custom1")
        fields.push([
            {
                "name": `${stat.FlagCaps} Flags Capped`,
                "value": `${stat.ChestOpens} Chests Oppend`,
                "inline": true
            }
        ]);
    fields.push([
        {
            "name": text.track.report.summary.TimePlayedSeconds[lang].replace("<MM>", Math.floor(stat.TimePlayedSeconds/60)).replace("<SS>", stat.TimePlayedSeconds % 60),
            "value": text.track.report.summary.DistanceTraveled[lang].replace("<#>", stat.DistanceTraveled/1000),
            "inline": true
        },
        {
            "name": `----- ${text.track.report.combat[lang]} ${stat["Kills" + type]} (+${20 * stat["Kills" + type]} XP) -----`,
            "value": "** **"
        }
    ]);

    lists.reportCombatList.forEach(function(statistic) {
        if (statistic == "EmuKills" && !stat.EmuKills)
            return;
        fields.push({
            "name": stat[statistic],
            "value": text.track.report.combat[statistic][lang],
            "inline": true
        });
    });

    if (stat.BananaHits)
        lists.reportBananaHitsList.forEach(function(statistic) {
            fields.push({
                "name": stat[statistic],
                "value": text.track.report.combat[statistic][lang],
                "inline": true
            });
        });

    fields = fields.concat([
        {
            "name": `----- ${text.track.report.gameplay[lang]}: ${Math.floor(stat.TimePlayedSeconds/60)}:${stat.TimePlayedSeconds % 60} (+${stat.TimePlayedSeconds} XP) -----`,
            "value": "** **",
        },
        {
            "name": `${stat.HealthJuiceDrank}oz${stat.HealthJuiceDrank ? " (" + (stat.HealthJuiceDrank / 100).toFixed(2) + "x💓)" : ""}`,
            "value": text.track.report.gameplay.HealthJuiceDrank[lang],
            "inline": true
        },
        {
            "name": stat.TapeUsed,
            "value": text.track.report.gameplay.TapeUsed[lang],
            "inline": true
        },
        {
            "name": stat.CampfiresUsed,
            "value": text.track.report.gameplay.CampfiresUsed[lang],
            "inline": true
        }
    ]);

    if (stat.CoconutsAte)
        fields.push({
            "name": `${stat.CoconutsAte} (+${stat.CoconutsAte * 5}HP)`,
            "value": text.track.report.gameplay.CoconutsAte[lang],
        });
        
    fields.push({
        "name": text.track.report.gameplay.ParachuteSplats[stat.ParachuteSplats][lang],
        "value": text.track.report.gameplay.ParachuteSplats[lang],
        "inline": true        
    });

    lists.reportGameplayList.forEach(function(statistic) {
        fields.push({
            "name": statistic == "DistanceTraveled" ? `${stat.DistanceTraveled/1000}km` : stat[statistic],
            "value": text.track.report.gameplay[statistic][lang],
            "inline": true 
        });
    });

    if (type != "Custom1")
        fields.push({
            "name": `----- ${stat["Wins" + type] ? `${text.track.report.events.Wins[lang]} (+150 XP)` : (stat["Top" + TopN(type) + type] ? `${text.track.report.events.Top[lang].replace("<#>", TopN(type))} (+100 XP)` : `${text.track.report.events.default[lang]} (+50 XP)`)} -----`,
            "value": "** **",
        });
    else
        fields.push({
            "name": "----- GamePlay -----",
            "value": "** **"
        });

    if (stat.MoleCrates)
        fields.push({
            "name": `${stat.MoleCrates}/2`,
            "value": text.track.report.events.MoleCrates[lang],
            "inline": true
        });

    if (stat.Scarecrows)
        fields.push({
            "name": `${stat.Scarecrows}/4`,
            "value": text.track.report.events.Scarecrows[lang],
            "inline": true
        });
    
    lists.reportEventList.forEach(function(statistic) {
        if (stat[statistic])
            fields.push({
                "name": text.Achievement[statistic][lang],
                "value": text.track.report.events[statistic][lang]
            });
    });
    
    return fields;
}

function ProfileEmbedDescription(lang, page = 0) {
    var title = `${text.common.GAMETYPE.Solos[lang]} ${text.common.GAMETYPE.Duos[lang]} ${text.common.GAMETYPE.Squads[lang]} ${text.common.GAMETYPE.Overall[lang]} Misc`;
    
    switch(page) {
    case 0:
        return title.replace(text.common.GAMETYPE.Solos[lang], `***${text.common.GAMETYPE.Solos[lang]}***`);
    case 1:
        return title.replace(text.common.GAMETYPE.Duos[lang], `***${text.common.GAMETYPE.Duos[lang]}***`);
    case 2:
        return title.replace(text.common.GAMETYPE.Squads[lang], `***${text.common.GAMETYPE.Squads[lang]}***`);
    case 3:
        return title.replace(text.common.GAMETYPE.Overall[lang], `***${text.common.GAMETYPE.Overall[lang]}***`);
    case 4:
        return title.replace("Misc", "***Misc***");
    }
}

function ProfileEmbedFields(lang, stat, rank, page = 0) {
    if (page < 3) {
        var type;
        switch(page) {
        case 0:
            type = ""; break;
        case 1:
            type = "Duos"; break;
        case 2:
            type = "Squads";
        }

        var fields =  [
            {
                "name": text.profile.summary.Kd[lang],
                "value": stat["Kd" + type].toFixed(2),
                "inline": true
            },
            {
                "name": text.profile.summary.Wr[lang],
                "value": `${(stat["Wr" + type] * 100).toFixed(2)}%`,
                "inline": true
            },
            {
                "name": text.profile.summary.Tr[lang].replace("<#>", TopN(type)),
                "value": `${(stat["Tr" + type] * 100).toFixed(2)}%`,
                "inline": true
            },
            {
                "name": `---------- ${text.profile.combat[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": text.profile.combat.AvgKills[lang].replace("<#>", stat["AvgKills" + type].toFixed(2)),
                "value": text.profile.combat.Kills[lang].replace("<#>", stat["Kills" + type])
                    + `\n(${text.common.rank[lang].replace("<#>", rank["Kills" + type]).replace("<#>", rank["Kills" + type])})`,
                "inline": true
            },
            {
                "name": text.profile.combat.Kd[lang].replace("<#>", stat["Kd" + type].toFixed(2)),
                "value": text.profile.combat.MostKills[lang].replace("<#>", stat["MostKills" + type])
                    + `\n(${text.common.rank[lang].replace("<#>", rank["MostKills" + type])})`,
                "inline": true
            },
            {
                "name": `---------- ${text.profile.gameplay[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": text.profile.gameplay.Wr[lang].replace("<#>", (stat["Wr" + type] * 100).toFixed(2)),
                "value": text.profile.gameplay.Wins[lang].replace("<#>", stat["Wins" + type]) + ` (${text.common.rank[lang].replace("<#>", rank["Wins" + type])})`,
                "inline": true
            },
            {
                "name": text.profile.gameplay.Tr[lang].replace("<#>", (stat["Tr" + type] * 100).toFixed(2)).replace("<A>", TopN(type)),
                "value": text.profile.gameplay.Top[lang].replace("<#>", stat["Top" + TopN(type) + type]).replace("<A>", TopN(type)) + ` (${text.common.rank[lang].replace("<#>", rank["Top" + TopN(type) + type])})`,
                "inline": true
            },
            {
                "name": `${text.profile.gameplay.Games[lang].replace("<#>", stat["Games" + type])} (${(stat["Games" + type] / stat.GamesAll * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank["Games" + type])})`,
                "value": "** **"
            }
        ];

        if (page == 1 || page == 2) {
            var carry = stat["Deaths" + type] + stat["Wins" + type] - stat["Games" + type];
            fields.pop();
            fields.push(
                {
                "name": `${text.profile.gameplay.Games[lang].replace("<#>", stat["Games" + type])} (${(stat["Games" + type] / stat.GamesAll * 100).toFixed(2)}%)  (${text.common.rank[lang].replace("<#>", rank["Games" + type])})`,
                "value": `${text.profile.gameplay.Carry[lang].replace("<#>", carry)} (${(carry / stat["Wins" + type] * 100).toFixed(2)}%)`
                }
            );
        }

        return fields;
    }

    else if (page == 3) {
        var carry = stat.DeathsAll + stat.WinsAll - stat.GamesAll;
        return [
            {
                "name": text.profile.summary.Kd[lang],
                "value": stat.KdAll.toFixed(2),
                "inline": true
            },
            {
                "name": text.profile.summary.Wr[lang],
                "value": `${(stat.WrAll * 100).toFixed(2)}%`,
                "inline": true
            },
            {
                "name": `---------- ${text.profile.combat[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": text.profile.combat.AvgKills[lang].replace("<#>", stat.AvgKills.toFixed(2)),
                "value": "** **", "inline": true
            },
            {
                "name": text.profile.combat.Kd[lang].replace("<#>", stat.KdAll.toFixed(2)),
                "value": "** **", "inline": true
            },
            {
                "name": text.profile.combat.Kills[lang].replace("<#>", stat.KillsAll),
                "value": "** **", "inline": true
            },
            {
                "name": `---------- ${text.profile.gameplay[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": text.profile.gameplay.Wr[lang].replace("<#>", (stat.WrAll * 100).toFixed(2)),
                "value": text.profile.gameplay.Wins[lang].replace("<#>", stat.WinsAll),
                "inline": true
            },
            {
                "name": text.profile.gameplay.TimePlayedSeconds[lang].replace("<MM>", Math.floor(stat.TimePlayedSeconds / stat.GamesAll / 60)).replace("<SS>", Math.floor(stat.TimePlayedSeconds / stat.GamesAll % 60)),
                "value": `Time played: ${Math.floor((stat.TimePlayedSeconds % (86400 * 30)) / 86400)}D ${Math.floor((stat.TimePlayedSeconds % 86400) / 3600)}H ${Math.floor((stat.TimePlayedSeconds % 3600) / 60)}M ${stat.TimePlayedSeconds % 60}S (${text.common.rank[lang].replace("<#>", rank.TimePlayedSeconds)})`,
                "inline": true
            },
            {
                "name": text.profile.gameplay.Games[lang].replace("<#>", stat.GamesAll),
                "value": `${text.profile.gameplay.Carry[lang].replace("<#>", carry)} (${(carry / stat.WinsAll * 100).toFixed(2)}%)`
            }
        ];

    }
    
    else {
        return [
            {
                "name": `---------- ${text.profile.combat[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": `${stat.DamageDealt}dmg Dealt`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.DamageDealt)})`,
                "inline": true
            },
            {
                "name": `${stat.SkunkBombDamageDealt} Skunk bomb dmg Dealt`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.SkunkBombDamageDealt)})`,
                "inline": true
            },
            {
                "name": `${stat.EnemyArmorBroken} Enemy Armor Broken`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.EnemyArmorBroken)})`,
                "inline": true
            },
            {
                "name": `${text.profile.combat.GrenadeKills[lang].replace("<#>", stat.GrenadeKills)}`,
                "value": `(${(stat.GrenadeKills / stat.KillsAll * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank.GrenadeKills)})`,
                "inline": true
            },
            {
                "name": `${text.profile.combat.VehicleKills[lang].replace("<#>", stat.VehicleKills)}`,
                "value": `(${(stat.VehicleKills / stat.KillsAll * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank.VehicleKills)})`,
                "inline": true
            },
            {
                "name": "** **", "value": "** **", "inline": true
            },
            {
                "name": `${text.profile.combat.MeleeKills[lang].replace("<#>", stat.MeleeKills)}`,
                "value": `(${(stat.MeleeKills / stat.KillsAll * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank.MeleeKills)})`,
                "inline": true
            },
            {
                "name": `${text.profile.combat.EmuKills[lang].replace("<#>", stat.EmuKills)}`,
                "value": `\n(${(stat.EmuKills / stat.KillsAll * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank.EmuKills)})`,
                "inline": true
            },
            {
                "name": "** **", "value": "** **", "inline": true
            },
            {
                "name": `Most Bow Hits: ${stat.BowHitsOneMatch}`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.BowHitsOneMatch)})`
            },
            {
                "name": `${stat.BananaHitsEnemyOnly} Banana slips caused (${text.common.rank[lang].replace("<#>", rank.BananaHits)})`,
                "value": `${text.profile.combat.BananaHitsEnemyOnly[lang].replace("<#>", stat.BananaHitsEnemyOnly)} (${(stat.BananaHitsEnemyOnly / stat.BananaHits * 100).toFixed(2)}%) (${text.common.rank[lang].replace("<#>", rank.BananaHitsEnemyOnly)})`
                + `\n${text.profile.combat.BananaHitsFriendly[lang].replace("<#>", stat.BananaHitsFriendly)} (${(stat.BananaHitsFriendly / stat.BananaHits * 100).toFixed(2)}%)`
            },
            {
                "name": `---------- ${text.profile.gameplay[lang]} ----------`,
                "value": "** **"
            },
            {
                "name": `${stat.HealthJuiceDrank}oz of Health Juice Drank`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.HealthJuiceDrank)})`,
                "inline": true
            },
            {
                "name": `${stat.TapeUsed} Super Tapes Used`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.TapeUsed)})`,
                "inline": true
            },
            {
                "name": `** **`,
                "value": `** **`, "inline": true
            },
            {
                "name": `${stat.CampfiresUsed} Campfires Lit`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.CampfiresUsed)})`,
                "inline": true
            },
            {
                "name": `${stat.CoconutsAte} Coconuts Ate`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.CoconutsAte)})`,
                "inline": true
            },
            {
                "name": `** **`,
                "value": `** **`, "inline": true
            },
            {
                "name": `${stat.ParachuteSplats} Failed Landing`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.ParachuteSplats)})`,
                "inline": true
            },
            {
                "name": `${stat.DistanceTraveled / 1000}km Traveled`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.DistanceTraveled)})`,
                "inline": true
            },
            {
                "name": `${stat.SuperJumpRolls} Super Jump Rolls`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.SuperJumpRolls)})`,
                "inline": true
            },
            {
                "name": `${stat.GrassCut} Grass Cuts`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.GrassCut)})`,
                "inline": true
            },
            {
                "name": `${stat.DestructiblesDestroyed} Objects destroyed`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.DestructiblesDestroyed)})`,
                "inline": true
            },
            {
                "name": `** **`,
                "value": `** **`, "inline": true
            },
            {
                "name": `${stat.MoleCrates} Mole Crates Opened`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.MoleCrates)})`,
                "inline": true
            },
            {
                "name": `${stat.Scarecrows} Scarecrows destroyed`,
                "value": `(${text.common.rank[lang].replace("<#>", rank.Scarecrows)})`,
                "inline": true
            }
        ];
    }
}

function EarnedXP(prevLV, gainedLV, currentXP, prevXP) {
    if (!gainedLV)
        return currentXP;

    var totalXp = currentXP;
    var i;
    for (i = 0; i < gainedLV; i++)
        totalXp += MaxXP(prevLV + i);
    return totalXp - prevXP;
}

function MaxXP(lv) {
    if (lv <= 10)
        return lv * 100;
    else if (lv < 23)
        return 1800 + (lv - 11) * 200;
    else
        return 4200;
}

function XPChart(lv, xp) {
    var chart = "";
    const p = (xp / MaxXP(lv)).toFixed(1) * 10;
    var i;
    for (i = 0; i < p; i++)
        chart += "🟦";
    for (; i < 10; i++)
        chart += "⬜";

    return chart;
}

function TopN(type) {
    switch (type) {
    case "":
    case "Solos":
        return "5";
    case "Duos":
        return "3";
    case "Squads":
        return "2";
    
    default:
        return null;
    }
}

function LangSwitch(lang){
    switch(lang) {
    case '🇺🇸':
    case '🇬🇧':
        return "en";
    case "en":
        return "🇺🇸/🇬🇧";

    case '🇰🇷':
    case '🇰🇵':
        return "ko";
    case "ko":
        return '🇰🇷';

    case '🇨🇳':
        return "zh_cn";
    case "zh_cn":
        return '🇨🇳';

    case "zh_tw":
        return '🇹🇼';
    case '🇹🇼':
        return "zh_tw";

    case "ms":
        return "🇲🇾";
    case "🇲🇾":
        return "ms";

    case "🇲🇽":
    case "🇨🇴":
    case "🇪🇸":
    case "🇦🇷":
    case "🇵🇪":
    case "🇻🇪":
    case "🇨🇱":
    case "🇪🇨":
    case "🇬🇹":
    case "🇨🇺":
    case "🇧🇴":
    case "🇩🇴":
    case "🇭🇳":
    case "🇵🇾":
    case "🇸🇻":
    case "🇳🇮":
    case "🇨🇷":
    case "🇵🇦":
    case "🇺🇾":
    case "🇵🇷":
    case "🇧🇿":
        return "es";
    case "es":
        return "🇪🇸";

    default:
        return null;
    }
}

function LangEmbed(lang = "en") {
    return new Promise(function(resolve, reject) {
        var embed = Object.assign({}, text.defaultEmbed);
        embed.fields = [
           { "name": "🇺🇸/🇬🇧 English", "value": "** **", "inline": true },
           { "name": "🇰🇷 한국어", "value": "** **", "inline": true },
           { "name": "🇹🇼 繁體中文", "value": "** **", "inline": true },
           { "name": "🇨🇳 简体中文", "value": "** **", "inline": true },
           { "name": "🇲🇾 Bahasa Melayu", "value": "** **", "inline": true },
           { "name": "🇪🇸 Español", "value": "** **", "inline": true }
        ];
        discordClient.users.fetch("480262009716211712").then(bananamilk => {
            embed.description = text.lang.description[lang].replace("<BANANAMILK>", bananamilk.tag);
            
            resolve(embed);
        });
    });
}

function QuizSwitch(index) {
    switch(index) {
    case 0:
        return "🇦";
    case 1:
        return "🇧";
    case 2:
        return "🇨";
    case 3:
        return "🇩";

    case "🇦":
        return 0;
    case "🇧":
        return 1;
    case "🇨":
        return 2;
    case "🇩":
        return 3;
    }
}

function PlayFabLogin() {
    PlayFab.settings.titleId = keys.PlayFabTitleId;

    var request = {
        // Currently, you need to look up the correct format for this object in the API reference for LoginWithCustomID.
        TitleId: PlayFab.settings.titleId,
        CustomId: keys.PlayFabId,
        CreateAccount: true
    };
    PlayFabClient.LoginWithCustomID(request, (error,  result) => {
        if (result !== null) {
            console.log("PlayFab API call successful");
            
            if (result.data.SessionTicket !== null)
                console.log("Loged in to PlayFab");
            else
                console.log("Failed to Log in PlayFab");
        }
        else if (error !== null)
            console.log("\nSomething went wrong.");
    });
}

PlayFabLogin();