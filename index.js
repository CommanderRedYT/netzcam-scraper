import { ArgumentParser } from 'argparse';
import path from 'path';
import fs from 'fs';

const parser = new ArgumentParser({
    description: 'Netzcam Scraper'
});

parser.add_argument('-p', '--project', { help: 'Project name', required: true, type: 'str' });
// 1-n number of webcams
parser.add_argument('-n', '--name', { help: 'Name of the camera(s)', required: true, nargs: '+' });
parser.add_argument('-o', '--output-dir', { help: 'Output directory', required: true, type: 'str' });
parser.add_argument('-m', '--mkdir', { help: 'Create output directory if it does not exist', action: 'store_true' });

const args = parser.parse_args();

const projectArg = args.project;
const namesArg = args.name;
const outputDirArg = args.output_dir;
const mkdirArg = args.mkdir;

let lastTime = [];

const getUrls = (project, name) => {
    const url = `https://${project}.netzcam.net/out/${name}`;
    const textUrl = `${url}.txt`;
    const imageUrl = `${url}.jpg`;

    return {textUrl, imageUrl};
};

if (!fs.existsSync(outputDirArg)) {
    if (mkdirArg) {
        fs.mkdirSync(outputDirArg, { recursive: true });
    } else {
        console.error('Output directory does not exist');
        process.exit(1);
    }
}

const fetchText = async (project) => {
    const func = async (project, name) => {
        try {
            const { textUrl } = getUrls(project, name);
            const response = await fetch(textUrl);

            if (!response.ok) {
                return null;
            }

            if (response.status !== 200) {
                return null;
            }

            return response.text();
        } catch (error) {
            return null;
        }
    };

    return Promise.all(namesArg.map(name => func(project, name)));
}

const fetchImage = async (project, name) => {
    try {
        const { imageUrl } = getUrls(project, name);
        const response = await fetch(imageUrl);

        if (!response.ok) {
            return null;
        }

        if (response.status !== 200) {
            return null;
        }

        return response.arrayBuffer();
    } catch (error) {
        return null;
    }
}

const handleSave = async () => {
    const texts = await fetchText(projectArg);

    const func = async (project, text, name, index) => {
        if (!text) {
            console.log('No text', new Date());
            return;
        }

        if (lastTime[index] && text === lastTime[index]) {
            console.log('No new image', new Date());
            return;
        }

        lastTime[index] = text;

        const imageBuffer = await fetchImage(project, name);

        if (!imageBuffer) {
            console.log('No image', new Date());
            return;
        }

        const curatedText = text.replace(/[^a-z0-9]/gi, '_');

        const fileName = `${curatedText}.jpg`;
        const fileDir = path.join(outputDirArg, name);

        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }

        const filePath = path.join(fileDir, fileName);

        fs.writeFileSync(filePath, Buffer.from(imageBuffer));

        console.log(`Saved ${filePath}`);
    };

    await Promise.all(namesArg.map((name, i) => {
        return func(projectArg, texts[i], name, i);
    }));
}

const index = async () => {
    const text = await fetchText(projectArg);

    if (!text || text.length === 0 || text.some(t => !t)) {
        console.error('Invalid project or name');
        process.exit(1);
    }

    lastTime = Array(text.length).fill(null);

    while (true) {
        await handleSave();
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
}

index();
