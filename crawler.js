const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
iconv.skipDecodeWarning = true

const getArticlesFromBoanNews = async () => {

    let articles = [];

    let CRAWL_URL = `https://www.boannews.com/media/t_list.asp`
    const html = await axios.get(CRAWL_URL, {
        responseEncoding: 'binary'
    });
    const htmlData = iconv.decode(html.data, 'euc-kr').toString();
    const $ = cheerio.load(htmlData);

    for (let i=0; i<=5; i++){
        const article = $('.news_list')[i]
        const url = $(article).find('a').attr('href')
        const title = $(article).find('.news_txt').text();
        const content = $(article).find('.news_content').text();
        const date = $(article).find('.news_writer').text();
        let data = {
            "article_title": title,
            "article_content": content,
            "article_date": date.split('| ')[1],
            "article_url": 'https://www.boannews.com/' + url, 
            "article_keyword": "보안"
        }
        articles.push(data); 
    }

    return articles;
}

module.exports = {
    getArticlesFromBoanNews
}