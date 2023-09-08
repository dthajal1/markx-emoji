import axios from "axios";
import { ethers } from "ethers";
import ProductNFT from "./ProductNFT.json" assert { type: "json" };
import ProductNFTFactory from './ProductNFTContract.json' assert { type: "json" };

interface Product {
    id: number;
    contractAddress: string;
    metadata: ProductData;
}

export interface ProductData {
    name: string;
    description: string;
    image: string;
    // imageName: string:
}

export const fetchProducts = async (web3Provider: ethers.providers.JsonRpcProvider) => {
    try {
        const productFactory = new ethers.Contract(process.env.NEXT_PUBLIC_PRODUCT_NFT_CONTRACT_ADDRESS || "", ProductNFTFactory.abi, web3Provider);

        const products: Product[] = []
        const productCount = await productFactory.getProductNFTsCount();
        const fetchMetadataPromises: Promise<ProductData>[] = [];

        for (let i = 0; i < Math.min(productCount.toNumber()); i++) {
            const contractAddress = await productFactory.productNFTs(i);
            fetchMetadataPromises.push(fetchMetadata(web3Provider, contractAddress));
            products.push({
                id: i,
                contractAddress,
                metadata: {
                    name: "",
                    description: "",
                    image: ""
                }
            });
        }

        const metadataResults = await Promise.all(fetchMetadataPromises);
        metadataResults.forEach((metadata, i) => {
            products[i].metadata = metadata;
        });

        return products;
    } catch (err) {
        console.log(`Failed to fetch products: ${err}`);
        return []
    }

}

export const fetchMetadata = async (web3Provider: ethers.providers.JsonRpcProvider, contractAddress: string) => {
    try {
        const contract = new ethers.Contract(contractAddress || "", ProductNFT.abi, web3Provider);
        const baseUri = await contract.baseUri();
        const ipfsEndpoint = baseUri.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/')
        const metadataUrl = ipfsEndpoint + '1.json';
        const metadataRes = await axios.get(metadataUrl);
        const metadata = metadataRes.data;
        const { name, description, image } = metadata;

        return {
            name,
            description,
            image,
        };
    } catch (err) {
        console.log(`Failed to fetch metadata: ${err}`);
        return {
            name: "",
            description: "",
            image: "",
        };
    }
};


export const fetchProductData = async (web3Provider: ethers.providers.JsonRpcProvider, contractAddress: string) => {
    try {
        const contract = new ethers.Contract(contractAddress || "", ProductNFT.abi, web3Provider);
        const baseUri = await contract.baseUri();
        const uniqueImagesBig = await contract.uniqueImages();
        const uniqueImages = uniqueImagesBig.toString();
        const ipfsEndpoint = baseUri.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/');
        const fetchMetadataPromises: Promise<any>[] = [];

        for (let i = 1; i <= uniqueImagesBig; i++) {
            const metadataUrl = ipfsEndpoint + i + '.json';
            fetchMetadataPromises.push(axios.get(metadataUrl));
        }

        const metadataResults = await Promise.all(fetchMetadataPromises);
        const data: ProductData[] = metadataResults.map((metadataRes) => metadataRes.data);

        return {
            data,
            uniqueImages
        }
    } catch (err) {
        console.log(`Failed to fetch product data: ${err}`);
        return {
            data: [],
            uniqueImages: ""
        };
    }
}