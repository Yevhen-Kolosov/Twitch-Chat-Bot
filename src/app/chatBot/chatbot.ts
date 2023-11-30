import { ChatBotConfig } from './../config/config.model';
import { TwitchTokenDetails } from './../models/twitchTokenDetails.models';
import { TwitchTokenResponseValidator } from './../utils/TwitchTokenResponseValidator';
import { MalformedTwitchRequestError, NoTwitchResponseError, TwitchResponseError } from '../models/error.model';
import fetch from 'node-fetch';


export class TwitchChatBot {

    tmi = require('tmi.js');

    public twitchClient: any;
    private broadcasterData: any;
    private moderatorData: any;
    private broadcasterId: any;
    private moderatorId: any;
    private tokenDetails!: TwitchTokenDetails;

    constructor(private config: ChatBotConfig) { }

    async launch() {
        this.tokenDetails = await this.fetchAccessToken();
        this.twitchClient = new this.tmi.Client(
            this.buildConnectionConfig(
                this.config.twitchChannel,
                this.config.twitchUser,
                this.tokenDetails.access_token)
        );
        this.setupBotBehavior();
        this.twitchClient.connect();
        this.broadcasterData = await this.getUsers([this.config.twitchChannel]);
        this.moderatorData = await this.getUsers(['ppsnz']);
        this.broadcasterId = await this.broadcasterData['data'][0]['id'];
        this.moderatorId = await this.moderatorData['data'][0]['id'];
    }

    private async fetchAccessToken(): Promise<TwitchTokenDetails> {
        const axios = require('axios');
        console.log("Fetching Twitch OAuth Token");
        return axios({
            method: 'post',
            url: this.config.twitchTokenEndpoint,
            params: {
                client_id: this.config.twitchClientId,
                client_secret: this.config.twitchClientSecret,
                code: this.config.twitchAuthorizationCode,
                grant_type: 'authorization_code',
                redirect_uri: 'http://localhost'

            },
            responseType: 'json'
        }).then(async function (response: any) {
            // handle success
            return await TwitchTokenResponseValidator.parseResponse(response.data);
        }).catch(function (error: any) {
            console.log("Failed to get Twitch OAuth Token");
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                throw new TwitchResponseError(error.response.data);
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                throw new NoTwitchResponseError(error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                throw new MalformedTwitchRequestError(error.request);
            }
        })
    }

    refreshTokenIfNeeded() {
        //TODO if needed - twitch apparently only requires the token on login so it is good enough for now to just get a token on start-up.
    }

    private timeNow: number = new Date().getTime();
    private lastTimeUsed: number = 0;
    private ppNote = "To enter the giveaway: request a ticket for channel points";

    //broadcasterId = await this.getUsers([this.config.twitchChannel])['data'][0].id;
    //moderatorId = await this.getUsers(['ppsnz'])['data'][0].id;

    private setupBotBehavior() {

        
        this.twitchClient.on('message', (channel: any, tags: any, message: any, self: any) => {

          this.timeNow = new Date().getTime();
          const isOnCooldown: boolean = ((this.timeNow - this.lastTimeUsed) <= 20000)
            //let helloCommand = "!hello"
            let basedCommand = "!ppCheck"
            let ppSetNote = "!ppSetNote"
            let ppNote = "!ppNote"
            let ppTimeout = "!ppTimeout"
            let ppUntimeout = "!ppUntimeout";
            let ppBan = "!ppBan";
            let ppUnban = "!ppUnban"

            //! means a command is coming by, and we check if it matches the command we currently support
            //if (message.startsWith('!') && message === helloCommand)
            //    this.sayHelloToUser(channel,tags);
            if (message === basedCommand && tags.username === 'ppsnz') {
                this.doPpCheck(channel, tags);
            }

            if (message === ppNote && tags.username === 'ppsnz') {
                this.sendNote(channel, tags);
            }

            if (message.startsWith(ppSetNote) && tags.username === 'ppsnz') {
                this.setNote(message, ppSetNote);
                this.twitchClient.say(channel, `HmmNotes ✅`);
            }

            if (message.toLowerCase().includes('@ppsnz') && tags.username === 'soly_er' && !isOnCooldown) {
                this.greetSoly(channel, tags);
                this.lastTimeUsed = new Date().getTime();
            }

            if (message.startsWith(ppTimeout) && tags.username === 'ppsnz') {
              this.timeoutPpTargets(channel, message, ppTimeout);
            }

            if (message.startsWith(ppUntimeout) && tags.username === 'ppsnz') {
              this.untimeoutPpTargets(channel, message, ppUntimeout);
            }

            if (message.startsWith(ppBan) && tags.username === 'ppsnz') {
              this.banPpTargets(channel, message, ppBan);
            }

            if (message.startsWith(ppUnban) && tags.username === 'ppsnz') {
              this.unbanPpTargets(channel, message, ppUnban);
            }
        });
    }

  //  private sayHelloToUser(channel: any, tags: any) {
  //          this.twitchClient.say(channel, `Hello, ${ tags.username }! Welcome to the channel.`);
  //  }

    private doPpCheck(channel: any, tags: any) {
              this.twitchClient.say(channel, `${this.moderatorId}, ${this.broadcasterId}`);
    }

    private timeoutPpTargets(channel: any, message: string, ppTimeout: string) {
              let inputString = message.replace(ppTimeout, '').trim().replace('@', '');
              let args = inputString.split(' | ');
              const targets = args[0].split(' ');

              if (targets.some(target => (target.length < 4 || target.length > 25))) {
                this.twitchClient.say(channel, `incorrect target KEKWait`);
                return;
              }

              let reason = args[2] || 'hmmmShotgun';
              let duration = args[1] || '123s';

              for (const target of targets) {
                this.twitchClient.say(channel, `.timeout ${target} ${duration} ${reason}`);
              }

              this.twitchClient.say(channel, `hmmmShotgun ✅`);
    }

    private untimeoutPpTargets(channel: any, message: string, ppUntimeout: string) {
              let inputString = message.replace(ppUntimeout, '').trim().replace('@', '');
              const targets = inputString.split(' ');

              if (targets.some(target => (target.length < 4 || target.length > 25))) {
                this.twitchClient.say(channel, `incorrect target KEKWait`);
                return;
              }

              for (const target of targets) {
                this.twitchClient.say(channel, `.untimeout ${target}`);
              }

              this.twitchClient.say(channel, `HmmEZ ✅`);
    }

    private async banPpTargets(channel: any, message: string, ppBan: string) {
              let inputString = message.replace(ppBan, '').trim().replace('@', '');
              const targets = inputString.split(' ');

              if (targets.some(target => (target.length < 4 || target.length > 25))) {
                this.twitchClient.say(channel, `incorrect target KEKWait`);
                return;
              }

              const response = await this.getUsers(targets);
              const targetsId = await response['data'].map(user => user.id);

              for (const targetId of await targetsId) {
                this.ppBanC(await targetId, 'hmmmShotgun');
              }
              
              this.twitchClient.say(channel, `hmmmShotgun ✅`);
    }

    private async unbanPpTargets(channel: any, message: string, ppUnban: string) {
              let inputString = message.replace(ppUnban, '').trim().replace('@', '');
              const targets = inputString.split(' ');

              if (targets.some(target => (target.length < 4 || target.length > 25))) {
                this.twitchClient.say(channel, `incorrect target KEKWait`);
                return;
              }

              const response = await this.getUsers(targets);
              const targetsId = await response['data'].map(user => user.id);

              for (const targetId of await targetsId) {
                this.ppUnbanC(await targetId);
              }

              this.twitchClient.say(channel, `HmmEZ ✅`);
    }

    private setNote(message: string, ppSetNote: string) {
              this.ppNote = message.replace(ppSetNote, '').trim();
    }
    
    private sendNote(channel: any, tags: any) {
              this.twitchClient.say(channel, this.ppNote);
    }

    private greetSoly(channel: any, tags: any) {
              this.twitchClient.say(channel, `soly amk peepoStare`);
    }

    private buildConnectionConfig(channel: string, username: string, accessToken: string) {
        return {
            options: { debug: true },
            connection: {
                secure: true,
                reconnect: true
            },
            identity: {
                username: `${username}`,
                password: `oauth:${accessToken}`
            },
            channels: [`${channel}`]
        };
    }

    private async getUsers(usersLogins) {
      try {
        const url = `https://api.twitch.tv/helix/users?login=${usersLogins.join('&login=')}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.tokenDetails.access_token}`,
            'Client-Id': `${this.config.twitchClientId}`,
          },
        })

        const result = await response.json();

        return await result;
      } catch (error) {console.error(error)}
    }

    private async ppBanC(targetId, reason) {
      try {
        const url = `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}`;
        const currentData = {
          'data': {
            'user_id': `${targetId}`,
            'reason': `${reason}`,
          }
        }

        const response = await fetch(url, {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${this.tokenDetails.access_token}`,
            'Client-Id': `${this.config.twitchClientId}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentData),
        })
      } catch (error) {console.error(error)}
    }

    private async ppUnbanC(targetId) {
      try {
        const url = `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.broadcasterId}&moderator_id=${this.moderatorId}&user_id=${targetId}`;

        const response = await fetch(url, {
          method: 'delete',
          headers: {
            'Authorization': `Bearer ${this.tokenDetails.access_token}`,
            'Client-Id': `${this.config.twitchClientId}`,
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {console.error(error)}
    }
}


