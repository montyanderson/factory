const Koa = require('koa');
const Router = require('@koa/router');
const Redis = require('ioredis');
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const router = new Router();

const redis = new Redis({
	host: 'redis'
});

router.get('/hello', async ctx => {
	ctx.body = "hello";
});

const timeout = 5; // seconds
const resultExpire = 86400; // one day

async function push(id, params) {
	await redis.multi()
		.zadd('jobs', 'NX', Date.now(), id)
		.set(`params:${id}`, JSON.stringify(params))
		.exec();
}

async function get() {
	return await redis.zrangebyscore('jobs', 0, -1, 'LIMIT', 10);
}

async function lock(id) {
	await redis.set(`lock:${id}`, 'true', 'EX', timeout, 'NX');
}

async function poll() {
	await redis.set(`lock:${id}`, timeout);
}

async function complete(id, result) {
	await redis.multi()
		.zrem('jobs', id)
		.del(`params:${id}`)
		.set(`result:${id}`, JSON.stringify(result), 'EX', resultExpire)
		.exec();
}

async function query() {
	 
}

router.post('/push', async ctx => {
	const {id, params} = ctx.request.body;

	await push(id, params);

	ctx.body = '';
});

router.post('/job', async ctx => {
	const jobs = await get();

	for(const job of jobs) {
		if(await lock(job) === true) {
			ctx.body = JSON.stringify(job);
		}
	}

	throw new Error('No jobs!');
});

router.post('/poll', async ctx => {
	const {id} = ctx.request.body;

	await poll(id);

	ctx.body = '';
});

router.post('/resolve', async ctx => {
	const {id, value} = ctx.request.body;

	await complete(id, {
		type: 'resolve',
		value
	});

	ctx.body = '';
});

router.post('/reject', async ctx => {
	const {id, error} = ctx.request.body;

	await complete(id, {
		type: 'reject',
		error
	});

	ctx.body = '';
});

app
	.use(bodyParser())
	.use(router.routes())
	.use(router.allowedMethods());

app.listen(3000);

console.log("factory server has started");
