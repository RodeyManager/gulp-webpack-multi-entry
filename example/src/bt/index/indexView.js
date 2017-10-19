
import { text } from '../test';
import moment from 'moment';
console.log(text);

const $header = document.querySelector('header');
setInterval(()=>{
    $header.textContent = moment().format('YYYY-MM-DD hh:mm:ss');
}, 1000);


