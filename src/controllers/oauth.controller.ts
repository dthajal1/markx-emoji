import { getEnvVar } from '@collabland/common';
import { APIApplicationCommandInteraction, BaseDiscordActionController, DiscordActionRequest, MessageFlags, RESTPostAPIWebhookWithTokenJSONBody } from '@collabland/discord';
import { inject, injectable } from '@loopback/core';
import { Response, RestBindings, get, param } from '@loopback/rest';
import axios from "axios";
import ethers from "ethers";
import { fetchProductData, fetchProducts } from '../contracts/productNFT.js';
import { removeData, retrieveData } from '../helpers/cache-manager.js';
import { Product } from '../helpers/utils.js';
import User from '../models/User.js';

@injectable()
export class OAuth2Controller extends BaseDiscordActionController<APIApplicationCommandInteraction> {
    constructor(@inject(RestBindings.Http.RESPONSE) private response: Response) {
        super();
    }

    @get('/oauth2/discord/redirect')
    async handleOAuth2Redirect(
        @param.query.string('code') code: string,
        @param.query.string('state') state: string
    ) {
        const storedInteraction = retrieveData<APIApplicationCommandInteraction>(state);

        if (code && storedInteraction) {
            try {
                // Exchange the authorization code for an access token
                const tokenResponse = await axios.post(
                    'https://api.collab.land/oauth2/token',
                    {
                        grant_type: 'authorization_code',
                        code,
                        client_id: getEnvVar('COLLABLAND_CLIENT_ID'),
                        client_secret: getEnvVar('COLLABLAND_CLIENT_SECRET'),
                        redirect_uri: getEnvVar('COLLABLAND_REDIRECT_URI'),
                    },
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    }
                );

                const accessToken = tokenResponse.data.access_token;

                let user = await User.findOne({ discordId: storedInteraction?.member?.user?.id });
                if (user) {
                    user.accessToken = accessToken;
                } else {
                    user = new User({
                        discordId: storedInteraction?.member?.user?.id,
                        accessToken,
                    });
                }

                /* prefetch data from blockchain and store it on db */
                // retrieve our NFTs and create token gating rule using its address
                const web3Provider = new ethers.providers.JsonRpcProvider(`${process.env.NEXT_PUBLIC_POLYGON_TESTNET_RPC_URL}${process.env.NEXT_PUBLIC_INFURA_API_KEY}`);
                const productNFTs = await fetchProducts(web3Provider);
                // console.log("contrraact addresses")
                // productNFTs.map((productMetaData, i) => {
                //   console.log(productMetaData.contractAddress)
                // });
                // console.log("contrraact addresses done printing")
                const rules = productNFTs.map((productMetaData, i) => ({
                    type: 'ERC721',
                    chainId: 80001,
                    minToken: '1',
                    contractAddress: productMetaData.contractAddress,
                    roleId: i.toString(),
                }));

                // ex rules = [memberNFT, primeNFT]

                // console.log("retrieved our NFTs");
                // TODO: modify to work for multiple wallets
                // retrieve user's wallet address
                const response = await axios.get("https://api.collab.land/account/wallets", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                const userWallets = response.data.items;

                // verify user holds our NFTs and prepare for display
                const gatewayUrl = "https://ipfs.io/ipfs/";
                const productsToDisplay: Product[] = []
                if (userWallets.length > 0) {
                    const response = await axios.post(
                        'https://api.collab.land/access-control/check-roles',
                        {
                            account: userWallets[0].address,
                            rules,
                        },
                        {
                            headers: {
                                Accept: 'application/json',
                                'X-API-KEY': getEnvVar('COLLABLAND_API_KEY'),
                                'Content-Type': 'application/json',
                            },
                        }
                    )

                    const result = response.data.roles;
                    // const arr_expressions = [
                    //     ['proud', 'happy'],
                    //     ['happy', 'energetic', 'confused', ':P', 'wisdom', 'curious', ':P', 'confused', 'wisdom', 'energetic', 'happy', 'curious'],
                    //     ['cute', 'curious', 'satisfied', 'cry', 'angry', 'slay'],
                    //     ['heart', 'sleepy', 'lazy', 'shy', 'give', 'celebrate', 'rose', 'angry', 'idea', 'tired']
                    // ]
                    let counter = 0;

                    for (let i = 0; i < result.length; i++) {
                        if (result[i].granted) {
                            const product: Product = {
                                name: productNFTs[i].metadata.name,
                                description: productNFTs[i].metadata.description,
                                mergedImgUrl: "",
                                images: []
                            }
                            const productData = await fetchProductData(web3Provider, productNFTs[i].contractAddress); // is productNFTs[result[i].id.toInt()].contractAddress the same?
                            const { uniqueImages, data } = productData;
                            // const expressions = arr_expressions[counter]
                            counter += 1
                            // const imageUrls = []
                            for (let j = 0; j < uniqueImages; j++) {
                                product.images.push(data[j].image.replace("ipfs://", gatewayUrl));
                                // imageUrls.push(data[j].image.replace("ipfs://", gatewayUrl));
                            }

                            // const updatedImgs = await axios.post(
                            //     "http://localhost:3000/api/images/addTxt",
                            //     {
                            //         imgName: product.name,
                            //         imageUrls, // Replace with your image URLs
                            //         names: expressions, // Replace with your names
                            //     }
                            //     // TODO: add headers??
                            // )

                            // product.images = [...updatedImgs.data]

                            const mergedImg = await axios.post(
                                `${getEnvVar('BASE_URL')}/api/images/merge`,
                                {
                                    imgName: product.name,
                                    imageUrls: product.images, // Replace with your image URLs
                                }
                            )

                            product.mergedImgUrl = mergedImg.data;
                            productsToDisplay.push(product);
                        }
                    }
                }

                // console.log("verified NFTs");
                user.products = productsToDisplay;
                // console.log("saved products: ", user.products)

                await user.save();

                const followUpMsg = `You now have access to your emoji NFTs collection, run the /view-emojis command to see it in action!`
                await this.followup(storedInteraction, followUpMsg)

                removeData(state);

                // Send a response to the client
                return this.response.send(
                    'Authorization successful, you can safely close this window.'
                );
            } catch (err) {
                console.error('Failed to exchange authorization code for access token:', err);
                // Handle the error and send an appropriate response to the client
                return this.response.send('Authorization failed. Please try again.');
            }
        } else {
            // Handle the case when code or state is missing and send an appropriate response
            return this.response.send('Authorization failed. Please try again.');
        }
    }

    private async followup(
        request: DiscordActionRequest<APIApplicationCommandInteraction>,
        message: string,
    ) {
        const callback = request.actionContext?.callbackUrl;
        if (callback != null) {
            const followupMsg: RESTPostAPIWebhookWithTokenJSONBody = {
                content: message,
                flags: MessageFlags.Ephemeral,
            };

            await this.followupMessage(request, followupMsg);
        }
    }
}
