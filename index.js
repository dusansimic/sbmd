#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const util = require('util');
const showdown = require('showdown');
const meow = require('meow');

const cli = meow(`
	Usage
		$ sbmd [options]

	Options
		--templates, -t    Pick templates directory
		--posts, -p        Pick posts directory
		--static, -s       Pick output directory
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
		}
	}
});

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const converter = new showdown.Converter();
converter.setOption('tasklists', true);

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

		for (const file of files) {
			if (path.extname(file) !== '.md') continue;
			const data = await readFile(path.join(blogPostsPath, file), { encoding: 'utf8' });

			const dataSplit = data.split('\n');
			const headingData = dataSplit.splice(0, 4);
			const dataJoined = dataSplit.join('\n');
			const parsedData = converter.makeHtml(dataJoined);

			const htmlData = (await readFile(path.join(blogTemplatesPath, 'post.tmpl.html'), { encoding: 'utf8' })).replace(/{{postTitle}}/g, headingData[0]).replace(/{{author}}/g, headingData[1]).replace(/{{date}}/g, headingData[2]).replace(/{{time}}/g, headingData[3]).replace(/{{postBody}}/g, parsedData);
			const htmlFilename = `post/${file.slice(0, file.length - 3)}.html`;

			await writeFile(path.join(blogStaticPath, htmlFilename), htmlData);
			console.log(htmlFilename);

			postsList.unshift({
				title: headingData[0],
				author: headingData[1],
				date: headingData[2],
				time: headingData[3],
				file: htmlFilename
			});
		}

		let postsListString = '';
		for (const post of postsList) {
			const postString = `<li id="posts-list-elem"><article><time>${post.date} ${post.time}</time><span><a href="${post.file}">${post.title}</a> <small>by ${post.author}</small></span></article></li>`;
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
