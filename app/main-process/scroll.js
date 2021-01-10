import { ipcMain } from 'electron';
import Log from '../models/logModel';

ipcMain.on('scroll', async (event, arg) => {
  const { filterOptions, nin } = arg;
  const filterProps = [];

  const totalAmtOfLogs = await Log.find({}).countDocuments();
  const hasNoMoreLogs = nin.length === totalAmtOfLogs;

  if (hasNoMoreLogs) {
    event.reply('scroll-reply', hasNoMoreLogs);
  } else {
    // Only run query if hasNoMoreLogs is false
    Object.keys(filterOptions).forEach((key) => {
      if (key === 'timestamp' && filterOptions[key].to) filterProps.push(key);
      else if (filterOptions[key].length !== 0 && key !== 'timestamp')
        filterProps.push(key);
    });
    if (!filterProps.length) {
      Log.find({ _id: { $nin: nin } })
        .sort({ timestamp: -1 })
        .limit(100)
        .exec((err, logs) => {
          if (err) console.log(err);
          else {
            const scrollReply = logs.map((log) => {
              return {
                ...log,
                _id: log._id.toString(),
                _doc: { ...log._doc, _id: log._id.toString() },
              };
            });
            event.reply('scroll-reply', scrollReply);
          }
        });
    } else {
      const query = {};
      const filterQuery = [];
      let searchFlag = false;
      for (let i = 0; i < filterProps.length; i++) {
        if (filterProps[i] === 'timestamp') {
          filterQuery.push({
            timestamp: {
              $gte: new Date(filterOptions.timestamp.from),
              $lte: new Date(filterOptions.timestamp.to),
            },
          });
          break;
        }
        if (filterProps[i] === 'private_port') {
          for (let j = 0; j < filterOptions.private_port.length; j++) {
            filterQuery.push({
              'ports.PrivatePort': parseInt(filterOptions.private_port[j]),
            });
          }
          break;
        }

        if (filterProps[i] === 'public_port') {
          for (let j = 0; j < filterOptions.public_port.length; j++) {
            filterQuery.push({
              'ports.PublicPort': parseInt(filterOptions.public_port[j]),
            });
          }
          break;
        }
        if (filterProps[i] === 'host_ip') {
          for (let j = 0; j < filterOptions.host_ip.length; j++) {
            filterQuery.push({ 'ports.IP': filterOptions.host_ip[j] });
          }
          break;
        }
        if (filterProps[i] === 'search') {
          searchFlag = true;
          break;
        }
        for (let j = 0; j < filterOptions[filterProps[i]].length; j++) {
          filterQuery.push({
            [filterProps[i]]: filterOptions[filterProps[i]][j],
          });
        }
      }

      if (filterQuery.length) query.$or = filterQuery;
      if (searchFlag) query.$text = { $search: filterOptions.search };

      Log.find({ ...query, _id: { $nin: nin } })
        .sort({ timestamp: -1 })
        .limit(100)
        .exec((err, logs) => {
          if (err) {
            console.log('ERROR HYD', err);
          } else {
            event.reply(
              'scroll-reply',
              logs.map((log) => {
                return {
                  ...log,
                  _id: log._id.toString(),
                  _doc: { ...log._doc, _id: log._id.toString() },
                };
              })
            );
          }
        });
    }
  }
});
