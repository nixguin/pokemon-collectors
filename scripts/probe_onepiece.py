import urllib.request, json
groups_data = json.loads(urllib.request.urlopen('https://tcgcsv.com/tcgplayer/68/groups').read())
groups = groups_data['results']
for g in groups[-15:]:
    gid = g['groupId']
    url = 'https://tcgcsv.com/tcgplayer/68/' + str(gid) + '/products'
    try:
        data = json.loads(urllib.request.urlopen(url, timeout=8).read())
        cards = [c for c in data['results'] if c.get('extendedData')]
        if cards:
            c = cards[0]
            print('Set:', g['name'], '| Card:', c['name'])
            for d in c['extendedData']:
                print(' ', d['name'], '=', d['value'])
            break
    except Exception as e:
        print('skip', gid, e)
