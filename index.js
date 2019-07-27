const fs = require('fs');
const path = require('path');
const util = require('util');
const showdown = require('showdown');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const converter = new showdown.Converter();
converter.setOption('tasklists', true);

const blogPostsPath = path.join(__dirname, 'posts');
if (!fs.existsSync('static')) fs.mkdirSync('static');
if (!fs.existsSync('static/post')) fs.mkdirSync('static/post');
const blogStaticPath = path.join(__dirname, 'static');
const blogTemplatesPath = path.join(__dirname, 'templates');
fs.createReadStream(path.join(blogTemplatesPath, 'style.css')).pipe(fs.createWriteStream(path.join(blogStaticPath, 'style.css')));

(async () => {
	try {
		let postsList = [];
		const files = await readdir(blogPostsPath);

		for (const file of files) {
			const data = await readFile(path.join(blogPostsPath, file), { encoding: 'utf8' });

			const dataSplit = data.split('\n');
			const headingData = dataSplit.splice(0, 4);
			const dataJoined = dataSplit.join('\n');
			const parsedData = converter.makeHtml(dataJoined);

			const htmlData = (await readFile(path.join(blogTemplatesPath, 'post.tmpl.html'), { encoding: 'utf8' })).replace(/{{postTitle}}/g, headingData[0]).replace(/{{author}}/g, headingData[1]).replace(/{{date}}/g, headingData[2]).replace(/{{time}}/g, headingData[3]).replace(/{{postBody}}/g, parsedData);
			const htmlFilename = `post/${file.slice(0, file.length - 3)}.html`;

			await writeFile(path.join(blogStaticPath, htmlFilename), htmlData);
			console.log(htmlFilename);

			postsList.push({
				title: headingData[0],
				author: headingData[1],
				date: headingData[2],
				time: headingData[3],
				file: htmlFilename
			});
		}

		postsList = postsList.reverse();

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
