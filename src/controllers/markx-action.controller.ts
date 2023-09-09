// Copyright Abridged, Inc. 2023. All Rights Reserved.
// Node module: @collabland/example-hello-action
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { getEnvVar } from '@collabland/common';
import {
    APIApplicationCommandAutocompleteInteraction,
    APIApplicationCommandAutocompleteResponse,
    APIApplicationCommandInteraction,
    APIChatInputApplicationCommandInteraction,
    APIInteraction,
    APIInteractionResponse,
    APIMessageComponentInteraction,
    APIMessageSelectMenuInteractionData,
    APIModalSubmitInteraction,
    ApplicationCommandOptionType,
    ApplicationCommandSpec,
    ApplicationCommandType,
    BaseDiscordActionController,
    DiscordActionMetadata,
    DiscordActionRequest,
    DiscordActionResponse,
    DiscordInteractionPattern,
    InteractionResponseType,
    InteractionType,
    MessageFlags,
    buildSimpleResponse,
    getSubCommandOption,
    getSubCommandOptionValue
} from '@collabland/discord';
import { MiniAppManifest } from '@collabland/models';
import { BindingScope, injectable } from '@loopback/core';
import { api } from '@loopback/rest';
import axios from 'axios';
import { storeData } from '../helpers/cache-manager.js';
import { PRIMARY_COLOR, Product, createEmbed, generateStateString, sanitizeNumber } from '../helpers/utils.js';
import User from '../models/User.js';


const temp_expressions_arr = [
    ['proud', 'happy'],
    ['happy', 'energetic', 'confused', ':P', 'wisdom', 'curious', ':P', 'confused', 'wisdom', 'energetic', 'happy', 'curious'],
    ['cute', 'curious', 'satisfied', 'cry', 'angry', 'slay'],
    ['heart', 'sleepy', 'lazy', 'shy', 'give', 'celebrate', 'rose', 'angry', 'idea', 'tired']
]

/**
 * HelloActionController is a LoopBack REST API controller that exposes endpoints
 * to support Collab Actions for Discord interactions.
 */
@injectable({
    scope: BindingScope.SINGLETON,
})
@api({ basePath: '/markx-emoji-action' }) // Set the base path to `/hello-action`
export class MarkXActionController extends BaseDiscordActionController<APIApplicationCommandInteraction> {
    /**
     * Expose metadata for the action
     * @returns
     */
    async getMetadata(): Promise<DiscordActionMetadata> {
        const metadata: DiscordActionMetadata = {
            /**
             * Miniapp manifest
             */
            manifest: new MiniAppManifest({
                appId: "markx-emoji-action",
                developer: "markx.io",
                name: "MarkX Emoji",
                platforms: ["discord"],
                shortName: "markx-emoji-action",
                version: { name: "0.0.1" },
                website: "https://www.markx.io",
                description: "[MarkX Emoji](https://www.markx.io/) gives users the ability to use their Emoji NFTs as stickers within the Discord servers. You can use your community brand or NFT IP to create emojis with the MarkX creator network and allow your community members to start communicating with it!\n\n**Get Free Custom Emojis for Your Community:**\n\n1. Follow Step 2 in Getting Started below: This step is required if you want the community to use your project emoji \n\n**To get started:**\n\n1. Install the MarkX Emoji mini-app from the [Collab.Land Marketplace](https://help.collab.land/marketplace/getting-started)\n\n2. [Create a Free Emoji](https://www.markx.io/create-emojis) collection for your IP (NFT or Brand) with the MarkX (Enter Promo Code: CollabLandFTW2023)\n\n3.  Buy/mint your community Emoji NFTs in the [MarkX marketplace (in testnet right now)](https://xyzport.com/browseProducts) using `/buy-emoji` command\n\n4. Give mini-app the permission to read wallets you have connected with [Collab.Land](http://Collab.Land) with `/connect-wallet` command\n\n5. Run `/view-emojis` command to view all the Emoji NFTs you own\n\n6. Share the Emoji NFT you own as stickers with others using `/post-emoji`\n\n",
                shortDescription: "MarkX Emoji gives users the ability to use their Emoji NFTs as stickers within the Discord servers.",
                icons: [
                    {
                        label: 'App icon',
                        src: `${getEnvVar('BASE_URL')}/MarkX_Logo.png`,
                        sizes: '512x512'
                    }
                ],
                thumbnails: [
                    {
                        label: 'view-emoji',
                        src: `${getEnvVar('BASE_URL')}/imgs/view-emoji.png`,
                        sizes: '1050x1150'
                    },
                    {
                        label: 'hello-world',
                        src: `${getEnvVar('BASE_URL')}/imgs/post-emoji-hello-world.png`,
                        sizes: '928x792'
                    },
                    {
                        label: 'heart',
                        src: `${getEnvVar('BASE_URL')}/imgs/post-emoji-heart.png`,
                        sizes: '934x784'
                    },
                    {
                        label: 'lets-get-started',
                        src: `${getEnvVar('BASE_URL')}/imgs/post-emoji-lets-get-started.png`,
                        sizes: '922x788'
                    },
                ],
                category: 'emojis',
                keywords: ['emojis', 'markx emoji', 'discord'], // TODO: curate it
            }),
            /**
             * Supported Discord interactions. They allow Collab.Land to route Discord
             * interactions based on the type and name/custom-id.
             */
            supportedInteractions: this.getSupportedInteractions(),
            /**
             * Supported Discord application commands. They will be registered to a
             * Discord guild upon installation.
             */
            applicationCommands: this.getApplicationCommands(),
        };
        return metadata;
    }


    protected async handleApplicationCommand(
        interaction: DiscordActionRequest<APIChatInputApplicationCommandInteraction>,
    ): Promise<DiscordActionResponse | undefined> {
        const user = await User.findOne({ discordId: interaction?.member?.user?.id });
        if (!user) {
            throw new Error(`Your wallet isn't connected. Use /connect-wallet to connect your wallet for NFT access`)
        }

        const productsToDisplay = user.products;
        const option = getSubCommandOption(interaction as APIChatInputApplicationCommandInteraction);

        console.log(`handling interaction (option.name=${option?.name})`);

        switch (option?.name) {
            case 'buy-emoji': {
                return this.handleBuyEmojiSubCmd();
            }
            case 'connect-wallet': {
                return this.handleConnectWalletSubCmd();
            }
            case 'view-emojis': {
                return this.handleViewEmojisSubCmd(productsToDisplay);
            }
            case 'post-emoji': {
                return this.handlePostEmojiSubCmd(interaction, productsToDisplay)
            }
            case 'help': {
                return this.handleHelpSubCmd();
            }
            case 'feedback': {
                return this.handleFeedbackSubCmd();
            }
            default: {
                throw new Error(`${option?.name} subcommand is invalid.`);
            }
        }

    }

    protected async handleMessageComponent(
        interaction: DiscordActionRequest<APIMessageComponentInteraction>,
    ): Promise<DiscordActionResponse | undefined> {
        console.log(`handling msg interaction ${interaction.data.custom_id}`);

        const user = await User.findOne({ discordId: interaction?.member?.user?.id });
        if (!user) {
            throw new Error(`Your wallet isn't connected. Use /connect-wallet to connect your wallet for NFT access`)
        }

        const productsToDisplay = user.products;

        switch (interaction.data.custom_id) {
            case 'connect-wallet-btn': {
                return this.handleConnectWalletMsgComponent(interaction);
            }
            case 'emoji_select_1': {
                return this.handleViewEmojisMsgComponent(interaction, productsToDisplay);
            }
            default: {
                return buildSimpleResponse(`${interaction.data.custom_id} message component is not implemented.`, true);
            }
        }
    }

    protected async handleModalSubmit(
        interaction: DiscordActionRequest<APIModalSubmitInteraction>,
    ): Promise<DiscordActionResponse | undefined> {

        switch (interaction.data.custom_id) {
            case 'feedback-submit': {
                return this.handleFeedbackModalSubmit(interaction)
            }
            default: {
                return buildSimpleResponse(`${interaction.data.custom_id} modal component is not implemented.`, true);
            }
        }
    }


    protected async handleApplicationCommandAutoComplete(
        interaction: DiscordActionRequest<APIApplicationCommandAutocompleteInteraction>,
    ): Promise<APIApplicationCommandAutocompleteResponse | undefined> {
        const user = await User.findOne({ discordId: interaction?.member?.user?.id });
        if (!user) {
            throw new Error(`Your wallet isn't connected. Use /connect-wallet to connect your wallet for NFT access`)
        }

        const productsToDisplay: Product[] = user.products;

        const option = interaction.data.options.find(o => {
            return (
                o.name == 'post-emoji' &&
                o.type == ApplicationCommandOptionType.Subcommand
            )
        })
        console.log(`handling autocomplete interaction for subcommand ${option?.name}`);

        if (option?.type == ApplicationCommandOptionType.Subcommand) {
            const subOption = option.options?.find(subO => {
                return (
                    subO.name == 'name' &&
                    subO.type == ApplicationCommandOptionType.String &&
                    subO.focused
                )
            })

            if (subOption?.type === ApplicationCommandOptionType.String) {
                const prefix = subOption.value.toLowerCase();
                const choices = await this.searchAutocompleteOptions(prefix, productsToDisplay);

                return {
                    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
                    data: {
                        choices,
                    },
                };
            }
        }
        return undefined
    }

    private handleBuyEmojiSubCmd(): APIInteractionResponse {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: "Follow the link below to buy Emoji NFTs in the MarkX marketplace",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                style: 5,
                                label: `Buy Emoji NFTs`,
                                url: "https://xyzport.com/browseProducts",
                                disabled: false,
                                type: 2,
                            },
                        ],
                    },
                ],

            },
        };
    }

    private handleConnectWalletSubCmd(): APIInteractionResponse {
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: "Connect your wallet to access your emoji NFTs collection!",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                style: 1,
                                label: `Add New Wallet`,
                                custom_id: `connect-wallet-btn`,
                                disabled: false,
                                type: 2,
                            },
                        ],
                    },
                ],
            },
        };
    }

    private handleConnectWalletMsgComponent(
        interaction: APIInteraction
    ): APIInteractionResponse {
        const scopes = 'user:wallet:read';
        const stateString = generateStateString(16);
        const oauth2Url = `https://api.collab.land/oauth2/authorize?response_type=code&client_id=${getEnvVar('COLLABLAND_CLIENT_ID')}&redirect_uri=${getEnvVar('COLLABLAND_REDIRECT_URI')}&scope=${scopes}&state=${stateString}`;

        storeData(stateString, interaction);

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: "Use this custom link to connect (valid for 5 mins)\n Note: This process may take a few minutes to finish. Hang tight!",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                style: 5,
                                label: `Connect Wallet`,
                                url: oauth2Url,
                                disabled: false,
                                type: 2,
                            },
                        ],
                    },
                ],

            },
        };
    }

    private handleViewEmojisSubCmd(
        productsToDisplay: Product[]
    ): APIInteractionResponse {
        if (productsToDisplay.length < 1) {
            return buildSimpleResponse(`You currently don't own any Emoji NFTs. Use /buy-emoji command to buy Emoji NFTs in the MarkX marketplace`, true);
        }

        const options = []
        for (let i = 0; i < productsToDisplay.length; i++) {
            const product = productsToDisplay[i]
            const option = {
                label: product.name,
                value: i.toString(),
                description: product.description
            }
            options.push(option)
        }

        const DEFAULT_SELECT_INDEX = 1;
        const selectedProduct = productsToDisplay[DEFAULT_SELECT_INDEX];

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                embeds: [createEmbed(selectedProduct)],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: "emoji_select_1",
                                options: options,
                                placeholder: "Select an emoji"
                            }
                        ]
                    }
                ]
            },
        };
    }

    private handleViewEmojisMsgComponent(
        interaction: APIInteraction,
        productsToDisplay: Product[]
    ): APIInteractionResponse {
        const interactionData = interaction.data as APIMessageSelectMenuInteractionData
        if (interactionData?.custom_id === "emoji_select_1") {
            const selectedOptionIndex = Number(interactionData.values?.[0]); // Convert to number
            const selectedProduct = productsToDisplay[selectedOptionIndex];

            return {
                type: InteractionResponseType.UpdateMessage,
                data: {
                    flags: MessageFlags.Ephemeral,
                    embeds: [createEmbed(selectedProduct)],
                },
            };
        }
        return buildSimpleResponse(`Custom id is invalid or doesn't exist.`, true);
    }

    private async handlePostEmojiSubCmd(
        interaction: APIInteraction,
        productsToDisplay: Product[]
    ): Promise<APIInteractionResponse> {
        let selectedEmoji = getSubCommandOptionValue(interaction as APIChatInputApplicationCommandInteraction, 'post-emoji', 'name') || "";
        const selectedTxt = getSubCommandOptionValue(interaction as APIChatInputApplicationCommandInteraction, 'post-emoji', 'text') || "";

        const [productIdxStr, imgIdxStr] = selectedEmoji.split('-');
        const productIdx = Number(productIdxStr)
        const imgIdx = Number(imgIdxStr)

        const product = productsToDisplay[productIdx]
        const imgUrl = product.images[imgIdx]
        const prodName = product.name;
        // const subProdName = product.images[imgIdx].name

        // const subProdName = temp_expressions_arr[productIdx][imgIdx]
        // const imgName = capitalizeWords(`${subProdName} ${prodName}`)

        const imgName = `${prodName} ${sanitizeNumber(imgIdx + 1)}`;

        const res = await axios.post(
            `${getEnvVar('BASE_URL')}/api/images/addTxt`,
            {
                imgName,
                imgUrl,
                txt: selectedTxt,
            }
            // TODO: add headers??
        )

        const embed = {
            color: PRIMARY_COLOR,
            image: {
                url: res.data
            }
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [embed]
            },
        };
    }

    private handleHelpSubCmd(): APIInteractionResponse {
        const embed = {
            title: `Help`,
            description: `**/buy-emoji**\nBuy Emoji NFTs in the MarkX marketplace. \n\n**/connect-wallet**\nConnect your wallet to the bot for NFT access. \n\n**/view-emojis**\nView a list of Emoji NFTs that you own as stickers. \n\n**/post-emoji**\nSend a specific sticker from your collection in the chat`,
            color: PRIMARY_COLOR
        }

        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            },
        };
    }

    private handleFeedbackSubCmd(): APIInteractionResponse {
        return {
            type: InteractionResponseType.Modal,
            data: {
                title: "Feedback",
                custom_id: 'feedback-submit',
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: 'feedback-text',
                                label: 'your feedback',
                                style: 2,
                                min_length: 10,
                                max_length: 1000,
                                required: true
                            },
                        ],
                    },
                ],

            },
        };
    }

    private handleFeedbackModalSubmit(interaction: APIModalSubmitInteraction): APIInteractionResponse {
        // TODO: submit it to developers
        // const components = interaction.data.components; // values submitted by the user
        // const name = components[0]?.components[0]?.value;
        return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
                flags: MessageFlags.Ephemeral,
                content: `Thank you for your feedback!`
            },
        };
    }

    private async searchAutocompleteOptions(query: string, productsToDisplay: Product[]): Promise<any[]> {
        const autocompleteOptions = []
        for (let i = 0; i < productsToDisplay.length; i++) {
            const product = productsToDisplay[i]
            // const expressions = temp_expressions_arr[i]
            for (let j = 0; j < product.images.length; j++) {
                const option = {
                    name: `${product.name} ${sanitizeNumber(j + 1)}`,
                    // name: capitalizeWords(`${expressions[j]} ${product.name}`),
                    value: `${i}-${j}`,
                }
                autocompleteOptions.push(option)
            }
        }

        const matchingOptions = autocompleteOptions.filter((option) =>
            option.name.toLowerCase().includes(query.toLowerCase())
        );

        return matchingOptions.slice(0, 25)
    }



    /**
   * Build a list of supported Discord interactions
   * @returns
   */
    private getSupportedInteractions(): DiscordInteractionPattern[] {
        return [
            {
                // Handle `/markx-action` slash command
                type: InteractionType.ApplicationCommand,
                names: ["markx"],
            },
            {
                type: InteractionType.ApplicationCommandAutocomplete,
                // names: ["markx", "post-emoji"]
                names: ["markx"]
            },
            {
                type: InteractionType.MessageComponent,
                ids: ["connect-wallet-btn", "emoji_select_1"],
            },
            // {
            //     type: InteractionType.ModalSubmit,
            //     ids: ["feedback-submit"],
            // },
        ];
    }

    /**
     * Build a list of Discord application commands. It's possible to use tools
     * like https://autocode.com/tools/discord/command-builder/.
     * @returns
     */
    private getApplicationCommands(): ApplicationCommandSpec[] {
        const commands: ApplicationCommandSpec[] = [
            // `/hello-action <your-name>` slash command
            {
                metadata: {
                    name: 'MarkX Emoji',
                    shortName: 'markx',
                    supportedEnvs: ['dev', 'qa', 'staging'],
                },
                name: 'markx',
                type: ApplicationCommandType.ChatInput,
                description: 'Use Emoji NFTs as stickers in discord servers',
                options: [
                    // `/markx buy-emoji <url>` slash command
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'buy-emoji',
                        description:
                            "Display a link to buy Emoji NFTs in the MarkX marketplace",
                        options: [],
                    },
                    // `/markx connect-wallet <url>` slash command
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'connect-wallet',
                        description:
                            "Connect your wallet to access your Emoji NFTs",
                        options: [],
                    },
                    // `/markx view-emojis <url>` slash command
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'view-emojis',
                        description:
                            "View a list of Emoji NFTs that you own as stickers",
                        options: [],
                    },
                    // `/markx post-emoji <url>` slash command
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'post-emoji',
                        description:
                            "Send a specific sticker from your collection in the chat.",
                        options: [
                            {
                                type: ApplicationCommandOptionType.String,
                                name: "name",
                                description: "name of emoji to send",
                                required: true,
                                autocomplete: true,
                            },
                            {
                                type: ApplicationCommandOptionType.String,
                                name: "text",
                                description: "the text to display",
                                required: false
                            },
                            // {
                            //     type: ApplicationCommandOptionType.Boolean,
                            //     name: "preview on",
                            //     description: "Flag to turn on/off preview",
                            //     required: false,
                            // },
                        ],
                    },
                    // `/markx help <url>` slash command
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'help',
                        description:
                            "View all available commands",
                        options: [],
                    },
                    // // `/markx feedback <url>` slash command
                    // {
                    //     type: ApplicationCommandOptionType.Subcommand,
                    //     name: 'feedback',
                    //     description:
                    //         "Submit feedback to the developer.",
                    //     options: [],
                    // },
                ],
            },
        ];
        return commands;
    }
}