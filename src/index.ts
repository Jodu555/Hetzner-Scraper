import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import { CommandManager, Command } from '@jodu555/commandmanager';

const commandManager = CommandManager.createCommandManager(process.stdin, process.stdout);

const idCheckList: {
    id: string;
    meta: {
        previousPrice: number;
        datacenter: string;
    };
}[] = [];

commandManager.registerCommand(
    new Command(
        'addServer', // The Command
        'addServer <Auction-ID>', // A Usage Info with arguments
        'Adds a Server', // A Description what the command does
        (command, [...args], scope) => {
            //Can be an Array
            if (args.length === 0) return 'Please provide an ID';

            args.shift();
            const id = args.shift();

            if (isNaN(parseInt(id))) return 'Please provide a valid ID';
            if (idCheckList.find(({ id: id2 }) => id === id2)) return `Server with the ID ${id} already exists`;

            idCheckList.push({ id, meta: { previousPrice: 0, datacenter: '' } });

            return `Server with the ID ${id} has been added`;
        }
    )
);

interface Server {
    id: number;
    key: number;
    name: string;
    description: string[];
    information: string[];
    category: string;
    cat_id: number;
    cpu: string;
    cpu_count: number;
    is_highio: boolean;
    traffic: string;
    bandwidth: number;
    ram: string[];
    ram_size: number;
    price: number;
    setup_price: number;
    hourly_price: number;
    hdd_arr: string[];
    hdd_hr: string[];
    hdd_size: number;
    hdd_count: number;
    serverDiskData: {
        nvme: number[];
        sata: number[];
        hdd: number[];
        general: number[];
    };
    is_ecc: boolean;
    datacenter: string;
    datacenter_hr: string;
    specials: string[];
    dist: string[];
    fixed_price: boolean;
    next_reduce: number;
    next_reduce_hr: boolean;
    next_reduce_timestamp: number;
    ip_price: {
        Monthly: number;
        Hourly: number;
        Amount: number;
    };
}

interface APIResponse {
    server: Server[];
    serverCount: number;
}

function calcServerPrice(server: Server) {
    const serverPrice = (server.price + server.ip_price.Monthly) * (1 + 0.19);
    return serverPrice;
}

const pretify = (price: number | string) => parseFloat(price as string).toFixed(2) + '€';

main();
async function main() {
    sendDCWebhook('Bot has been started');
    const interval = setInterval(async () => {
        if (idCheckList.length === 0) return;
        const response = await axios.get<APIResponse>('https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json');
        idCheckList.forEach(({ id, meta }) => {
            const server = response.data.server.find((server) => server.id === parseInt(id));
            if (server) {
                const price = calcServerPrice(server);
                //Update
                meta.datacenter = server.datacenter;
                if (price !== meta.previousPrice && meta.previousPrice < price) {
                    const message = `Server with the ID ${id} has been updated from ${pretify(meta.previousPrice)} to ${pretify(price)} in the datacenter ${server.datacenter}`;
                    console.log(message);
                    sendDCWebhook(message);
                    meta.previousPrice = price;
                }
            } else {
                //Update + Delete
                const message = `Server with the ID ${id} has been deleted last price was ${pretify(meta.previousPrice)} in the datacenter ${meta.datacenter}`;
                console.log(message);
                sendDCWebhook(message);

                idCheckList.splice(idCheckList.findIndex(({ id: id2 }) => id === id2), 1);
            }
        });
    }, 1000 * 30);
    // }, 1000 * 60 * 5);
}

function sendDCWebhook(message: string) {
    const webhook = process.env.DISCORD_WEBHOOK;
    if (!webhook) return;

    axios.post(webhook, { content: message });
}
