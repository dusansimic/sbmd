#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const util = require('util');
const showdown = require('showdown');
const meow = require('meow');
const prompts = require('prompts');
const YAML = require('yamljs');

const cli = meow(`
	Usage
		$ sbmd [options]

	Options
		--templates, -t    Pick templates directory
		--posts, -p        Pick posts directory
		--static, -s       Pick output directory
		--flavour, -f      Pick markdown flavour
`, {
	flags: {
		templates: {
			type: 'string',
			alias: 't',
			default: path.join(__dirname, 'templates')
		},
		posts: {
			type: 'string',
			alias: 'p',
			default: path.join(process.cwd())
		},
		static: {
			type: 'string',
			alias: 's',
			default: path.join(process.cwd(), '..', 'static')
		},
		flavour: {
			type: 'string',
			alias: 'f',
			default: 'github'
		}
	}
});

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const converter = new showdown.Converter();
converter.setOption('tasklists', true);
if (!['original', 'github', 'ghost', 'vanilla', 'allOn'].includes(cli.flags.flavour)) {
	console.error(`Sorry but '${cli.flags.flavour}' is not a valid Markdown flavour.`);
	process.exit(1)
}
converter.setFlavor(cli.flags.flavour);

const blogPostsPath = cli.flags.posts;
const blogStaticPath = cli.flags.static;
const blogTemplatesPath = cli.flags.templates;
if (!fs.existsSync(blogStaticPath)) fs.mkdirSync(blogStaticPath);
if (!fs.existsSync(path.join(blogStaticPath, 'post'))) fs.mkdirSync(path.join(blogStaticPath, 'post'));
fs.createReadStream(path.join(blogTemplatesPath, 'style.css')).pipe(fs.createWriteStream(path.join(blogStaticPath, 'style.css')));

(async () => {
	try {
		let postsList = [];
		const files = await readdir(blogPostsPath);

		if (files.filter(file => path.extname(file) === '.md').length < 1) {
			const { value } = await prompts({
				type: 'confirm',
				name: 'value',
				message: 'No posts found! Continue?',
				initial: false
			});

			if (!value) process.exit(0);
		}

		for (const file of files) {
			if (path.extname(file) !== '.md') continue;
			const data = await readFile(path.join(blogPostsPath, file), { encoding: 'utf8' });

			const linesArray = data.split('\n');
			let metaBreakIndex = 0;
			for (const i in linesArray) {
				if (linesArray[i] == '---') {
					metaBreakIndex = parseInt(i);
					break;
				}
			}
			const postMetaData = YAML.parse(linesArray.splice(0, metaBreakIndex + 1).splice(0, metaBreakIndex).join('\n'));
			if (!postMetaData.hasOwnProperty('title')) {
				console.error(`Seems like your post '${file}' doesn't have a post title.`);
				process.exit(1);
			} else if (!postMetaData.hasOwnProperty('date')) {
				console.error(`Seems like your post '${file}' doesn't have a date.`);
				process.exit(1);
			}
			const postMarkdown = linesArray.join('\n');
			const parsedData = converter.makeHtml(postMarkdown);

			const metadataString = `${postMetaData.hasOwnProperty('author') ? `by ${postMetaData.author} ` : ''}on ${postMetaData.date} ${postMetaData.hasOwnProperty('time') ? `at ${postMetaData.time}` : ''}`;
			const htmlData = (await readFile(path.join(blogTemplatesPath, 'post.tmpl.html'), { encoding: 'utf8' })).replace(/{{postTitle}}/g, postMetaData.title).replace(/{{metadata}}/g, metadataString).replace(/{{postBody}}/g, parsedData);
			const htmlFilename = `post/${file.slice(0, file.length - 3)}.html`;

			await writeFile(path.join(blogStaticPath, htmlFilename), htmlData);
			console.log(htmlFilename);

			postsList.unshift({
				...postMetaData,
				file: htmlFilename
			});
		}

		let postsListString = '';
		for (const post of postsList) {
			const postString = `<li id="posts-list-elem"><article><time>${post.date} ${post.time}</time><span><a href="${post.file}">${post.title}</a>${post.hasOwnProperty('author') ? ` <small>by ${post.author}</small>` : ''}</span></article></li>`;
			postsListString += postString;
		}

		const data = await readFile(path.join(blogTemplatesPath, 'index.tmpl.html'), { encoding: 'utf8' });
		const htmlData = data.replace(/{{postsList}}/g, postsListString);
		await writeFile(path.join(blogStaticPath, 'index.html'), htmlData);
		console.log('index.html');
	} catch (error) {
		throw error;
	}
})();
